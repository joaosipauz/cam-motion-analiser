"""Configuracao via variaveis de ambiente (prefixo CMA_), no estilo Frigate."""
import os
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env(name, default):
    return os.environ.get(f"CMA_{name}", default)


def _default_hwaccel():
    if sys.platform == "win32":
        return "dxva2"
    if Path("/dev/dri").exists():
        return "vaapi"
    return "none"


@dataclass(frozen=True)
class Settings:
    media_dir: Path      # pasta com os videos (somente leitura)
    data_dir: Path       # banco, analises, exportacoes, caches
    model_dir: Path
    static_dir: Path     # build do frontend
    hwaccel: str | None  # dxva2 / d3d11va / vaapi / None
    ov_device: str       # AUTO / GPU / CPU
    ffmpeg: str
    run_worker: bool

    @property
    def db_path(self):
        return self.data_dir / "cma.db"

    @property
    def analyses_dir(self):
        return self.data_dir / "analyses"

    @property
    def exports_dir(self):
        return self.data_dir / "exports"

    @property
    def proxies_dir(self):
        return self.data_dir / "proxies"

    @property
    def cache_dir(self):
        return self.data_dir / "cache"

    def ensure_dirs(self):
        for d in (self.data_dir, self.analyses_dir, self.exports_dir,
                  self.proxies_dir, self.cache_dir):
            d.mkdir(parents=True, exist_ok=True)


def load_settings():
    hw = _env("HWACCEL", "auto")
    if hw == "auto":
        hw = _default_hwaccel()
    return Settings(
        media_dir=Path(_env("MEDIA_DIR", "/media")).resolve(),
        data_dir=Path(_env("DATA_DIR", ROOT / "data")).resolve(),
        model_dir=Path(_env("MODEL_DIR", ROOT / "models")).resolve(),
        static_dir=Path(_env("STATIC_DIR", ROOT / "frontend" / "dist")).resolve(),
        hwaccel=None if hw == "none" else hw,
        ov_device=_env("OV_DEVICE", "AUTO"),
        ffmpeg=_env("FFMPEG", "ffmpeg"),
        run_worker=_env("WORKER", "1") == "1",
    )


settings = load_settings()
