"""Worker: processo unico que consome a fila de jobs no SQLite.

Uma fila so evita que duas tarefas pesadas disputem a iGPU ao mesmo tempo.
"""
import logging
import time
import traceback

import numpy as np

from .. import db
from ..config import settings
from ..pipeline import clip, motion

log = logging.getLogger("worker")


def _progress(job_id):
    last = [0.0]

    def report(value):
        now = time.monotonic()
        if now - last[0] > 0.5:
            db.update_job(job_id, progress=value)
            last[0] = now
    return report


def analysis_path(video_id):
    return settings.analyses_dir / f"{video_id}.npz"


def job_motion_scan(job):
    video = db.get_video(job["video_id"])
    db.update_video(video["id"], analysis_status="running")
    t0 = time.perf_counter()
    try:
        ts, grid, mode = motion.scan(db.video_file(video), video["duration"],
                                     settings.hwaccel, _progress(job["id"]))
    except Exception:
        db.update_video(video["id"], analysis_status="error")
        raise
    np.savez_compressed(analysis_path(video["id"]), ts=ts, grid=grid)
    db.update_video(video["id"], analysis_status="done")
    elapsed = time.perf_counter() - t0
    return {**mode, "samples": int(len(ts)), "elapsed": elapsed,
            "speed": video["duration"] / max(elapsed, 1e-6)}


def job_proxy(job):
    video = db.get_video(job["video_id"])
    out = settings.proxies_dir / f"{video['id']}.mp4"
    clip.make_proxy(db.video_file(video), video, out, _progress(job["id"]))
    db.update_video(video["id"], proxy_path=out.name, playable=1)
    return {"proxy": out.name}


def job_export_clip(job):
    video = db.get_video(job["video_id"])
    p = job["params"]
    src = db.video_file(video)
    model = p.get("model", "ia")
    suffix = f"{p['mode']}-{model}" if p["mode"] == "enhanced" else p["mode"]
    stem = f"{video['id']}_{p['start']:.1f}-{p['end']:.1f}_{suffix}"
    out = settings.exports_dir / f"{stem}.mp4"
    report = _progress(job["id"])
    if p["mode"] == "fast":
        clip.export_copy(src, p["start"], p["end"], out, report)
    elif p["mode"] == "precise":
        clip.export_precise(src, p["start"], p["end"], out, report)
    elif p["mode"] == "enhanced":
        clip.export_enhanced(src, p["start"], p["end"], p["roi"], out, report, model)
    else:
        raise ValueError(f"modo desconhecido: {p['mode']}")
    return {"file": out.name, "size": out.stat().st_size}


HANDLERS = {
    "motion_scan": job_motion_scan,
    "proxy": job_proxy,
    "export_clip": job_export_clip,
}


def run_forever():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s worker %(message)s")
    db.init_db()
    db.requeue_interrupted()
    log.info("pronto (hwaccel=%s, ov_device=%s)", settings.hwaccel, settings.ov_device)
    while True:
        job = db.claim_next()
        if not job:
            time.sleep(0.5)
            continue
        log.info("job %s %s iniciado", job["id"], job["kind"])
        try:
            result = HANDLERS[job["kind"]](job)
            db.update_job(job["id"], status="done", progress=1.0, result=result)
            log.info("job %s concluido: %s", job["id"], result)
        except Exception as e:
            log.error("job %s falhou\n%s", job["id"], traceback.format_exc())
            db.update_job(job["id"], status="error", message=str(e))


if __name__ == "__main__":
    run_forever()
