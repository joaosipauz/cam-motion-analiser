"""Pastas de videos cadastradas, navegador de pastas do computador e biblioteca.

O app so le dentro das pastas cadastradas; o navegador de pastas lista apenas
diretorios (nunca conteudo de arquivos) para o usuario escolher uma pasta.
"""
import os
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import db

router = APIRouter(prefix="/api")

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".ts", ".m4v", ".dav", ".h264", ".h265"}
SKIP_DIRS = {"$recycle.bin", "system volume information", "$windows.~bt", "$windows.~ws",
             "proc", "sys", "dev"}


def is_video(name):
    return Path(name).suffix.lower() in VIDEO_EXTS


def folder_of(path):
    """Pasta cadastrada que contem `path`, ou None."""
    p = Path(path).resolve()
    for f in db.list_folders():
        root = Path(f["path"])
        if p == root or root in p.parents:
            return f
    return None


def inside_folders(path):
    p = Path(path).resolve()
    if not folder_of(p):
        raise HTTPException(403, "Caminho fora das pastas de videos cadastradas")
    return p


def _scan_dirs(base):
    """Subpastas visiveis de `base` e quantos videos ha diretamente nela."""
    dirs, videos = [], 0
    try:
        entries = sorted(os.scandir(base), key=lambda e: e.name.lower())
    except (PermissionError, OSError):
        return dirs, videos
    for e in entries:
        if e.name.startswith((".", "$")) or e.name.lower() in SKIP_DIRS:
            continue
        try:
            if e.is_dir():
                dirs.append({"name": e.name, "path": e.path})
            elif is_video(e.name):
                videos += 1
        except OSError:
            continue
    return dirs, videos


# --- pastas cadastradas ----------------------------------------------------------

@router.get("/folders")
def list_folders():
    return [{**f, "name": Path(f["path"]).name or f["path"], "exists": Path(f["path"]).is_dir()}
            for f in db.list_folders()]


class FolderIn(BaseModel):
    path: str


@router.post("/folders")
def add_folder(body: FolderIn):
    raw = body.path.strip().strip('"')
    if not raw:
        raise HTTPException(400, "Informe o caminho da pasta")
    p = Path(os.path.expanduser(raw)).resolve()
    if not p.is_dir():
        raise HTTPException(404, f"Pasta nao encontrada: {p}")
    f = db.add_folder(str(p))
    return {**f, "name": p.name or str(p), "exists": True}


@router.delete("/folders/{folder_id}")
def remove_folder(folder_id: int):
    """Tira a pasta da lista. Nada e apagado do disco; videos ja abertos continuam no app."""
    db.remove_folder(folder_id)
    return {"ok": True}


# --- navegador de pastas do computador -----------------------------------------------

def _places():
    home = Path.home()
    names = [("Downloads", "Downloads"), ("Vídeos", "Videos"), ("Área de trabalho", "Desktop"),
             ("Documentos", "Documents")]
    places = [{"name": "Pasta pessoal", "path": str(home)}]
    places += [{"name": label, "path": str(home / d)} for label, d in names if (home / d).is_dir()]
    if sys.platform == "win32":
        places += [{"name": f"Disco {d.rstrip(os.sep)}", "path": d} for d in os.listdrives()]
    else:
        places.append({"name": "Raiz do sistema", "path": "/"})
        places += [{"name": p, "path": p} for p in ("/media", "/mnt") if Path(p).is_dir()]
    return places


@router.get("/browse")
def browse(path: str = ""):
    """Subpastas de `path` para escolher uma pasta de videos. Sem path: atalhos e discos."""
    if not path:
        return {"path": "", "parent": None, "places": _places(), "dirs": [], "videos": 0}
    p = Path(path).resolve()
    if not p.is_dir():
        raise HTTPException(404, "Pasta nao encontrada")
    dirs, videos = _scan_dirs(p)
    parent = str(p.parent) if p.parent != p else ""
    return {"path": str(p), "parent": parent, "places": [], "dirs": dirs, "videos": videos}


# --- biblioteca (conteudo das pastas cadastradas) ------------------------------------

@router.get("/library")
def library(path: str = ""):
    """Sem path: as pastas cadastradas. Com path: subpastas e videos dentro dele."""
    if not path:
        return {"path": "", "parent": None, "root": None, "roots": list_folders(),
                "dirs": [], "files": []}
    base = inside_folders(path)
    if not base.is_dir():
        raise HTTPException(404, "Pasta nao encontrada")
    root = folder_of(base)
    registered = {str(Path(v["path"])): v["id"] for v in db.list_videos()}
    dirs, files = [], []
    try:
        entries = sorted(os.scandir(base), key=lambda e: e.name.lower())
    except PermissionError:
        raise HTTPException(403, "Sem permissao para ler esta pasta")
    for e in entries:
        if e.name.startswith((".", "$")) or e.name.lower() in SKIP_DIRS:
            continue
        try:
            if e.is_dir():
                dirs.append({"name": e.name, "path": e.path})
            elif is_video(e.name):
                st = e.stat()
                files.append({"name": e.name, "path": e.path, "size": st.st_size,
                              "modified": st.st_mtime, "video_id": registered.get(str(Path(e.path)))})
        except OSError:
            continue
    parent = "" if str(base) == root["path"] else str(base.parent)
    return {"path": str(base), "parent": parent,
            "root": {"id": root["id"], "path": root["path"], "name": Path(root["path"]).name or root["path"]},
            "roots": None, "dirs": dirs, "files": files}
