"""Trechos favoritos de cada video (um ponto quando inicio == fim)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .. import db
from .videos import get_video_or_404

router = APIRouter(prefix="/api")


class FavoriteIn(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    name: str = Field("", max_length=200)


class FavoritePatch(BaseModel):
    start: float | None = Field(None, ge=0)
    end: float | None = Field(None, ge=0)
    name: str | None = Field(None, max_length=200)


@router.get("/videos/{video_id}/favorites")
def list_favorites(video_id: str):
    get_video_or_404(video_id)
    return db.list_favorites(video_id)


@router.post("/videos/{video_id}/favorites")
def add_favorite(video_id: str, body: FavoriteIn):
    v = get_video_or_404(video_id)
    start, end = sorted((body.start, body.end))
    if start > v["duration"] + 1:
        raise HTTPException(400, "Trecho alem da duracao do video")
    return db.add_favorite(video_id, start, min(end, v["duration"]), body.name.strip())


@router.patch("/favorites/{fav_id}")
def update_favorite(fav_id: int, body: FavoritePatch):
    fav = db.get_favorite(fav_id)
    if not fav:
        raise HTTPException(404, "Favorito nao encontrado")
    fields = {k: (v.strip() if isinstance(v, str) else v)
              for k, v in body.model_dump().items() if v is not None}
    if fields:
        db.update_favorite(fav_id, **fields)
    return db.get_favorite(fav_id)


@router.delete("/favorites/{fav_id}")
def delete_favorite(fav_id: int):
    db.delete_favorite(fav_id)
    return {"ok": True}
