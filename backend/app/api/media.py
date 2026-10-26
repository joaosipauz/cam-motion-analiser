"""Melhoria de quadro, exportacao de trechos e jobs."""
import io
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response
from PIL import Image, PngImagePlugin
from pydantic import BaseModel, Field

from .. import db
from ..config import settings
from ..pipeline import decode, enhance
from .videos import get_video_or_404, parse_roi

router = APIRouter(prefix="/api")

Roi = tuple[float, float, float, float]


AI_MODES = tuple(enhance.AI_MODELS)
MODE_PATTERN = f"^(bicubic|fiel|{'|'.join(AI_MODES)})$"


class EnhanceIn(BaseModel):
    t: float
    roi: Roi
    mode: str = Field("fiel", pattern=MODE_PATTERN)
    frames: int = Field(15, ge=3, le=45)


@router.get("/videos/{video_id}/sharpest")
def sharpest(video_id: str, t: float, roi: str, window: float = Query(2.0, gt=0, le=5),
             count: int = Query(4, ge=1, le=12)):
    """Quadros mais nitidos da area em t +/- window (o rosto/placa pode estar melhor ali)."""
    v = get_video_or_404(video_id)
    area = parse_roi(roi)
    scored = [(ts, enhance.sharpness(decode.crop(img, area)[0]))
              for ts, img in decode.frames_in_window(db.video_file(v),
                                                     t - window, t + window)]
    if not scored:
        raise HTTPException(404, "Nenhum quadro no intervalo")
    current = min(scored, key=lambda s: abs(s[0] - t))
    picked = []
    min_gap = 0.25  # evita quadros praticamente iguais
    for ts, score in sorted(scored, key=lambda s: -s[1]):
        if all(abs(ts - p[0]) >= min_gap for p in picked + [current]):
            picked.append((ts, score))
        if len(picked) == count:
            break
    best = max(s for _, s in scored)
    return sorted(
        ({"t": round(ts, 3), "sharpness": round(score / best, 3), "current": ts == current[0]}
         for ts, score in [current, *picked]),
        key=lambda f: f["t"])


def wall_clock(video, t):
    if not video["start_time"]:
        return None
    return (datetime.fromisoformat(video["start_time"]) + timedelta(seconds=t)).isoformat(
        timespec="seconds")


@router.post("/videos/{video_id}/enhance")
def enhance_frame(video_id: str, body: EnhanceIn):
    """Retorna PNG ampliado 4x da area selecionada no instante t."""
    v = get_video_or_404(video_id)
    count = body.frames if body.mode == "fiel" else 1
    frames, mid = decode.grab_frames(db.video_file(v), body.t, count)
    if not frames:
        raise HTTPException(404, "Quadro nao encontrado")
    pad = 8 if body.mode == "fiel" else 0
    crops = [decode.crop(f, body.roi, pad) for f in frames]
    (px0, py0, px1, py1) = crops[0][1]
    crops = [c for c, _ in crops]
    try:
        enhance.check_size(crops[0].shape[1] - px0 - px1, crops[0].shape[0] - py0 - py1)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if body.mode == "bicubic":
        out = enhance.bicubic(crops[mid])
    elif body.mode == "fiel":
        out = enhance.faithful(crops, mid)
    else:
        up = enhance.get_upscaler(body.mode)
        if not up.available:
            raise HTTPException(503, "Modelo de IA nao instalado")
        out = up(crops[mid])
    s = enhance.SCALE
    out = out[py0 * s:out.shape[0] - py1 * s, px0 * s:out.shape[1] - px1 * s]

    meta = {"video": v["name"], "t": round(body.t, 3), "clock": wall_clock(v, body.t),
            "roi": body.roi, "mode": body.mode, "scale": s,
            "ai_generated_detail": body.mode in AI_MODES}
    info = PngImagePlugin.PngInfo()
    info.add_text("cam-motion-analiser", json.dumps(meta))
    buf = io.BytesIO()
    Image.fromarray(out).save(buf, "PNG", pnginfo=info)
    return Response(buf.getvalue(), media_type="image/png",
                    headers={"X-Enhance-Meta": json.dumps(meta)})


class ExportIn(BaseModel):
    start: float = Field(ge=0)
    end: float
    mode: str = Field("fast", pattern="^(fast|precise|enhanced)$")
    roi: Roi | None = None
    model: str = Field("ia", pattern=f"^({'|'.join(AI_MODES)})$")


@router.post("/videos/{video_id}/export")
def export_clip(video_id: str, body: ExportIn):
    v = get_video_or_404(video_id)
    if body.end <= body.start:
        raise HTTPException(400, "Fim deve ser depois do inicio")
    if body.end > v["duration"] + 1:
        raise HTTPException(400, "Fim alem da duracao do video")
    if body.mode == "enhanced":
        if not body.roi:
            raise HTTPException(400, "Selecione a area a ser melhorada")
        w = int(body.roi[2] * v["width"])
        h = int(body.roi[3] * v["height"])
        try:
            enhance.check_size(w, h)
        except ValueError as e:
            raise HTTPException(400, str(e))
    job_id = db.enqueue("export_clip", video_id, body.model_dump())
    return {"job_id": job_id}


@router.get("/exports/{name}")
def download_export(name: str):
    path = (settings.exports_dir / name).resolve()
    if path.parent != settings.exports_dir or not path.is_file():
        raise HTTPException(404, "Arquivo nao encontrado")
    return FileResponse(path, filename=name)


@router.get("/jobs")
def list_jobs(video_id: str | None = None):
    return db.list_jobs(video_id)


@router.get("/jobs/{job_id}")
def get_job(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job nao encontrado")
    return job
