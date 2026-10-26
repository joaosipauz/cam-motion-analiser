"""SQLite local (WAL). Uma conexao por operacao: simples e seguro entre API e worker."""
import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER,
    duration REAL,
    width INTEGER,
    height INTEGER,
    fps REAL,
    codec TEXT,
    container TEXT,
    start_time TEXT,
    start_time_source TEXT,
    playable INTEGER DEFAULT 0,
    proxy_path TEXT,
    analysis_status TEXT DEFAULT 'pending',
    added_at REAL
);
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    video_id TEXT,
    params TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL DEFAULT 0,
    message TEXT,
    result TEXT,
    created_at REAL,
    updated_at REAL
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, id);
CREATE INDEX IF NOT EXISTS jobs_video ON jobs(video_id, id);
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    start REAL NOT NULL,
    "end" REAL NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at REAL
);
CREATE INDEX IF NOT EXISTS favorites_video ON favorites(video_id, start);
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    added_at REAL
);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(settings.db_path, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    settings.ensure_dirs()
    with connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA)
        # versoes antigas guardavam o caminho relativo a CMA_MEDIA_DIR
        for r in conn.execute("SELECT id, path FROM videos").fetchall():
            if not Path(r["path"]).is_absolute():
                conn.execute("UPDATE videos SET path=? WHERE id=?",
                             (str(settings.media_dir / r["path"]), r["id"]))
        # CMA_MEDIA_DIR vira a primeira pasta cadastrada (como o volume /media do Docker)
        if conn.execute("SELECT COUNT(*) FROM folders").fetchone()[0] == 0 \
                and settings.media_dir.is_dir():
            conn.execute("INSERT INTO folders (path, added_at) VALUES (?, ?)",
                         (str(settings.media_dir), time.time()))


def video_file(video):
    return Path(video["path"])


# --- trechos favoritos -----------------------------------------------------------

def list_favorites(video_id):
    with connect() as conn:
        return [row(r) for r in conn.execute(
            "SELECT * FROM favorites WHERE video_id=? ORDER BY start", (video_id,))]


def get_favorite(fav_id):
    with connect() as conn:
        return row(conn.execute("SELECT * FROM favorites WHERE id=?", (fav_id,)).fetchone())


def add_favorite(video_id, start, end, name):
    with connect() as conn:
        cur = conn.execute(
            'INSERT INTO favorites (video_id, start, "end", name, created_at) VALUES (?,?,?,?,?)',
            (video_id, start, end, name, time.time()))
        return row(conn.execute("SELECT * FROM favorites WHERE id=?", (cur.lastrowid,)).fetchone())


def update_favorite(fav_id, **fields):
    sets = ", ".join(f'"{k}"=?' for k in fields)
    with connect() as conn:
        conn.execute(f"UPDATE favorites SET {sets} WHERE id=?", (*fields.values(), fav_id))


def delete_favorite(fav_id):
    with connect() as conn:
        conn.execute("DELETE FROM favorites WHERE id=?", (fav_id,))


# --- pastas de videos ----------------------------------------------------------

def list_folders():
    with connect() as conn:
        return [row(r) for r in conn.execute("SELECT * FROM folders ORDER BY path COLLATE NOCASE")]


def add_folder(path):
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO folders (path, added_at) VALUES (?, ?)",
                     (path, time.time()))
        return row(conn.execute("SELECT * FROM folders WHERE path=?", (path,)).fetchone())


def remove_folder(folder_id):
    with connect() as conn:
        conn.execute("DELETE FROM folders WHERE id=?", (folder_id,))


def row(r):
    if r is None:
        return None
    d = dict(r)
    for key in ("params", "result"):
        if d.get(key):
            d[key] = json.loads(d[key])
    return d


# --- videos -----------------------------------------------------------------

def get_video(video_id):
    with connect() as conn:
        return row(conn.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone())


def list_videos():
    with connect() as conn:
        return [row(r) for r in conn.execute("SELECT * FROM videos ORDER BY added_at DESC")]


def insert_video(v):
    cols = ", ".join(v)
    marks = ", ".join("?" for _ in v)
    with connect() as conn:
        conn.execute(f"INSERT INTO videos ({cols}) VALUES ({marks})", tuple(v.values()))


def update_video(video_id, **fields):
    sets = ", ".join(f"{k}=?" for k in fields)
    with connect() as conn:
        conn.execute(f"UPDATE videos SET {sets} WHERE id=?", (*fields.values(), video_id))


def delete_video(video_id):
    with connect() as conn:
        conn.execute("DELETE FROM favorites WHERE video_id=?", (video_id,))
        conn.execute("DELETE FROM jobs WHERE video_id=?", (video_id,))
        conn.execute("DELETE FROM videos WHERE id=?", (video_id,))


# --- jobs -------------------------------------------------------------------

def enqueue(kind, video_id=None, params=None):
    now = time.time()
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO jobs (kind, video_id, params, created_at, updated_at) VALUES (?,?,?,?,?)",
            (kind, video_id, json.dumps(params or {}), now, now))
        return cur.lastrowid


def claim_next():
    with connect() as conn:
        r = conn.execute(
            "UPDATE jobs SET status='running', updated_at=? "
            "WHERE id=(SELECT id FROM jobs WHERE status='queued' ORDER BY id LIMIT 1) "
            "RETURNING *", (time.time(),)).fetchone()
        return row(r)


def update_job(job_id, **fields):
    if "result" in fields:
        fields["result"] = json.dumps(fields["result"])
    fields["updated_at"] = time.time()
    sets = ", ".join(f"{k}=?" for k in fields)
    with connect() as conn:
        conn.execute(f"UPDATE jobs SET {sets} WHERE id=?", (*fields.values(), job_id))


def get_job(job_id):
    with connect() as conn:
        return row(conn.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())


def list_jobs(video_id=None, limit=50):
    with connect() as conn:
        if video_id:
            rs = conn.execute("SELECT * FROM jobs WHERE video_id=? ORDER BY id DESC LIMIT ?",
                              (video_id, limit))
        else:
            rs = conn.execute("SELECT * FROM jobs ORDER BY id DESC LIMIT ?", (limit,))
        return [row(r) for r in rs]


def requeue_interrupted():
    """Jobs que estavam rodando quando o processo caiu voltam para a fila."""
    with connect() as conn:
        conn.execute("UPDATE jobs SET status='queued', progress=0 WHERE status='running'")
