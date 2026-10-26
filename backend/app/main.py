"""Aplicacao unica: API + frontend estatico + worker em processo separado."""
import logging
import multiprocessing as mp
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import db
from .api import favorites, folders, media, videos
from .config import settings
from .worker.runner import run_forever

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    worker = None
    if settings.run_worker:
        worker = mp.get_context("spawn").Process(target=run_forever, name="worker", daemon=True)
        worker.start()
    log.info("midia=%s dados=%s", settings.media_dir, settings.data_dir)
    yield
    if worker:
        worker.terminate()
        worker.join(5)


app = FastAPI(title="cam-motion-analiser", lifespan=lifespan)
app.include_router(folders.router)
app.include_router(videos.router)
app.include_router(media.router)
app.include_router(favorites.router)


@app.get("/api/health")
def health():
    return {"ok": True}


if settings.static_dir.is_dir():
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
