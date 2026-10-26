"""Cadastro de videos, streaming e timeline de movimento."""
import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import db
from ..config import settings
from ..pipeline import decode, motion, timestamps
from ..worker.runner import analysis_path
from .folders import inside_folders

router = APIRouter(prefix="/api")


def parse_roi(text):
    if not text:
        return None
    try:
        x, y, w, h = (float(v) for v in text.split(","))
    except ValueError:
        raise HTTPException(400, "roi deve ser x,y,w,h normalizado")
    return x, y, w, h


def get_video_or_404(video_id):
    v = db.get_video(video_id)
    if not v:
        raise HTTPException(404, "Video nao encontrado")
    return v


@router.get("/config")
def get_config():
    return {"media_dir": str(settings.media_dir), "hwaccel": settings.hwaccel,
            "ov_device": settings.ov_device}


class RegisterIn(BaseModel):
    path: str


@router.post("/videos")
def register(body: RegisterIn):
    src = inside_folders(body.path)
    if not src.is_file():
        raise HTTPException(404, "Arquivo nao encontrado")
    vid = decode.video_id(src)
    existing = db.get_video(vid)
    if existing:
        # mesmo conteudo em outro lugar (arquivo movido ou renomeado): segue o arquivo
        if existing["path"] != str(src):
            db.update_video(vid, path=str(src), name=src.name)
        return db.get_video(vid)
    try:
        info = decode.probe(src)
    except Exception as e:
        raise HTTPException(400, f"Nao foi possivel ler o video: {e}")
    start, source = timestamps.detect(src.name, info.pop("creation_time"))
    playable = decode.is_playable(info)
    db.insert_video({
        "id": vid, "path": str(src), "name": src.name,
        "size": src.stat().st_size, **info, "start_time": start, "start_time_source": source,
        "playable": int(playable), "analysis_status": "queued", "added_at": time.time(),
    })
    db.enqueue("motion_scan", vid)
    if not playable:
        db.enqueue("proxy", vid)
    return db.get_video(vid)


@router.get("/videos")
def list_videos():
    return db.list_videos()


@router.get("/videos/{video_id}")
def get_video(video_id: str):
    v = get_video_or_404(video_id)
    v["jobs"] = db.list_jobs(video_id, limit=10)
    return v


class VideoPatch(BaseModel):
    start_time: str | None = None


@router.patch("/videos/{video_id}")
def patch_video(video_id: str, body: VideoPatch):
    get_video_or_404(video_id)
    db.update_video(video_id, start_time=body.start_time, start_time_source="manual")
    return db.get_video(video_id)


@router.delete("/videos/{video_id}")
def delete_video(video_id: str):
    """Remove so os dados gerados; o arquivo original nunca e tocado."""
    v = get_video_or_404(video_id)
    analysis_path(video_id).unlink(missing_ok=True)
    if v["proxy_path"]:
        (settings.proxies_dir / v["proxy_path"]).unlink(missing_ok=True)
    db.delete_video(video_id)
    return {"ok": True}


@router.post("/videos/{video_id}/analyze")
def reanalyze(video_id: str):
    get_video_or_404(video_id)
    db.update_video(video_id, analysis_status="queued")
    return {"job_id": db.enqueue("motion_scan", video_id)}


@router.get("/videos/{video_id}/stream")
def stream(video_id: str):
    v = get_video_or_404(video_id)
    if v["proxy_path"]:
        path = settings.proxies_dir / v["proxy_path"]
    elif v["playable"]:
        path = db.video_file(v)
    else:
        raise HTTPException(409, "Preparando video para reproducao")
    # FileResponse do Starlette atende Range: o navegador busca so o trecho necessario
    return FileResponse(path, media_type="video/mp4")


@router.get("/videos/{video_id}/frame")
def frame(video_id: str, t: float = 0.0, width: int = 320, roi: str | None = None):
    v = get_video_or_404(video_id)
    frames, mid = decode.grab_frames(db.video_file(v), t, 1)
    if not frames:
        raise HTTPException(404, "Quadro nao encontrado")
    img = frames[mid]
    if roi:
        img, _ = decode.crop(img, parse_roi(roi))
    h = round(img.shape[0] * width / img.shape[1])
    img = cv2.resize(img, (width, h), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(img, cv2.COLOR_RGB2BGR),
                           [cv2.IMWRITE_JPEG_QUALITY, 80])
    return Response(buf.tobytes(), media_type="image/jpeg",
                    headers={"Cache-Control": "max-age=86400"})


_analysis_cache = {}


def load_analysis(video_id):
    path = analysis_path(video_id)
    if not path.exists():
        return None
    key = (video_id, path.stat().st_mtime)
    if key not in _analysis_cache:
        _analysis_cache.clear()
        with np.load(path) as data:
            _analysis_cache[key] = (data["ts"], data["grid"])
    return _analysis_cache[key]


@router.get("/videos/{video_id}/motion")
def motion_timeline(video_id: str, roi: str | None = None,
                    threshold: float = Query(0.01, ge=0, le=1),
                    bins: int = Query(1500, ge=10, le=20000),
                    start: float | None = Query(None, ge=0), end: float | None = None):
    """Timeline recalculada na hora para qualquer ROI/sensibilidade.

    Com start/end, as barras cobrem so esse intervalo (usado na previa do trecho).
    """
    v = get_video_or_404(video_id)
    data = load_analysis(video_id)
    if data is None:
        raise HTTPException(409, "Analise ainda nao concluida")
    ts, grid = data
    scores = motion.roi_scores(grid, parse_roi(roi))
    if start is not None and end is not None and end > start:
        keep = (ts >= start) & (ts <= end)
        return {"duration": end - start,
                "bins": motion.binned(ts[keep] - start, scores[keep], end - start, bins)
                .round(4).tolist(),
                "segments": []}
    return {
        "duration": v["duration"],
        "bins": motion.binned(ts, scores, v["duration"], bins).round(4).tolist(),
        "segments": motion.segments(ts, scores, threshold, v["duration"]),
    }


@router.get("/videos/{video_id}/keyframe")
def keyframe(video_id: str, t: float = Query(ge=0)):
    """Onde o corte rapido (sem recodificar) realmente comeca para um inicio em t."""
    v = get_video_or_404(video_id)
    return {"t": decode.keyframe_before(db.video_file(v), t)}
