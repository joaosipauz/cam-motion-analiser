"""Abertura de video, metadados e captura de quadros com PyAV."""
import hashlib
import os

import av
import numpy as np
from av.codec.hwaccel import HWAccel

# containers/codecs que o navegador toca direto (HEVC depende do navegador/GPU)
PLAYABLE_CONTAINERS = {"mov,mp4,m4a,3gp,3g2,mj2"}
PLAYABLE_CODECS = {"h264", "hevc"}


def open_video(path, hwaccel=None):
    kw = {"hwaccel": HWAccel(device_type=hwaccel)} if hwaccel else {}
    return av.open(str(path), **kw)


def video_id(path):
    """Hash parcial (tamanho + 1 MB do inicio + 1 MB do fim): instantaneo mesmo em 20 GB."""
    size = os.path.getsize(path)
    h = hashlib.sha1(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(1 << 20))
        if size > 2 << 20:
            f.seek(-(1 << 20), os.SEEK_END)
            h.update(f.read(1 << 20))
    return h.hexdigest()[:16]


def probe(path):
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        duration = float(c.duration / av.time_base) if c.duration else float(s.duration * s.time_base)
        return {
            "duration": duration,
            "width": s.width,
            "height": s.height,
            "fps": float(s.average_rate or s.guessed_rate or 0),
            "codec": s.codec_context.name,
            "container": c.format.name,
            "creation_time": c.metadata.get("creation_time") or s.metadata.get("creation_time"),
        }


def is_playable(info):
    return info["container"] in PLAYABLE_CONTAINERS and info["codec"] in PLAYABLE_CODECS


def keyframe_interval(path, probe_seconds=60.0):
    """Intervalo medio entre keyframes, lendo so pacotes (sem decodificar)."""
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        times = []
        for pkt in c.demux(s):
            if pkt.pts is None:
                continue
            t = float(pkt.pts * s.time_base)
            if pkt.is_keyframe:
                times.append(t)
            if t > probe_seconds:
                break
    if len(times) < 2:
        return float("inf")
    return (times[-1] - times[0]) / (len(times) - 1)


def keyframe_before(path, t):
    """Instante do keyframe em ou antes de t: onde um corte sem recodificar comeca."""
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        c.seek(int(max(0.0, t) / s.time_base), stream=s, backward=True)
        for pkt in c.demux(s):
            if pkt.pts is not None and pkt.is_keyframe:
                return min(float(pkt.pts * s.time_base), t)
    return t


def grab_frames(path, t, count=1):
    """`count` quadros RGB em resolucao cheia ao redor do instante t.

    Retorna (quadros, indice do quadro mais proximo de t). Usa timestamps reais,
    entao funciona com taxa de quadros variavel.
    """
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        s.thread_type = "AUTO"
        c.seek(int(max(0.0, t - 2.0) / s.time_base), stream=s)
        before, after = [], []
        for frame in c.decode(s):
            if frame.pts is None:
                continue
            ts = float(frame.pts * s.time_base)
            if ts < t - 1e-3:
                before.append((ts, frame))
                if len(before) > count // 2:
                    before.pop(0)
                continue
            after.append((ts, frame))
            if len(after) >= count - len(before):
                break
    picked = (before + after)[:count]
    if not picked:
        return [], 0
    center = min(range(len(picked)), key=lambda i: abs(picked[i][0] - t))
    return [f.to_ndarray(format="rgb24") for _, f in picked], center


def frames_in_window(path, t0, t1):
    """Gera (ts, quadro RGB) para todos os quadros entre t0 e t1."""
    with av.open(str(path)) as c:
        s = c.streams.video[0]
        s.thread_type = "AUTO"
        c.seek(int(max(0.0, t0) / s.time_base), stream=s)
        for frame in c.decode(s):
            if frame.pts is None:
                continue
            ts = float(frame.pts * s.time_base)
            if ts < t0:
                continue
            if ts > t1:
                break
            yield ts, frame.to_ndarray(format="rgb24")


def crop(img, roi, pad=0):
    """Recorta ROI normalizada (x, y, w, h). Retorna recorte e o pad efetivamente aplicado."""
    h, w = img.shape[:2]
    x0, y0 = int(roi[0] * w), int(roi[1] * h)
    x1, y1 = int((roi[0] + roi[2]) * w), int((roi[1] + roi[3]) * h)
    # dimensoes pares facilitam o encode yuv420p depois
    x1 -= (x1 - x0) % 2
    y1 -= (y1 - y0) % 2
    px0, py0 = min(pad, x0), min(pad, y0)
    px1, py1 = min(pad, w - x1), min(pad, h - y1)
    out = img[y0 - py0:y1 + py1, x0 - px0:x1 + px1]
    return np.ascontiguousarray(out), (px0, py0, px1, py1)
