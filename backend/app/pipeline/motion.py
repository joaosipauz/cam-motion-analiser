"""Varredura de movimento.

A varredura guarda, por amostra, uma grade GRID_H x GRID_W com a fracao de pixels
em movimento em cada celula. Assim a area de interesse (ROI) e a sensibilidade
podem ser trocadas na interface instantaneamente, sem decodificar o video de novo.
"""
import cv2
import numpy as np

from .decode import keyframe_interval, open_video

GRID_W, GRID_H = 32, 18
SCAN_WIDTH = 320


def _samples(path, hwaccel, step):
    """Gera (ts, cinza reduzido). step=0 -> so keyframes; step>0 -> 1 quadro a cada step s."""
    with open_video(path, hwaccel) as c:
        s = c.streams.video[0]
        if not hwaccel:
            s.thread_type = "AUTO"
        if step == 0:
            s.codec_context.skip_frame = "NONKEY"
        height = round(s.height * SCAN_WIDTH / s.width / 2) * 2
        next_ts = 0.0
        for frame in c.decode(s):
            if frame.pts is None:
                continue
            ts = float(frame.pts * s.time_base)
            if ts < next_ts:
                continue
            next_ts = ts + step
            yield ts, frame.reformat(width=SCAN_WIDTH, height=height, format="gray").to_ndarray()


def scan(path, duration, hwaccel=None, progress=None, diff_threshold=25, bg_alpha=0.05):
    """Retorna (ts float32[N], grid uint8[N, GRID_H, GRID_W]) e o modo usado."""
    kf = keyframe_interval(path)
    # cameras com GOP longo (>3 s) precisam de amostragem fixa para nao perder eventos
    step = 0.0 if kf <= 3.0 else 1.0
    try:
        samples = _samples(path, hwaccel, step)
        first = next(samples)
    except Exception:
        if not hwaccel:
            raise
        hwaccel = None
        samples = _samples(path, None, step)
        first = next(samples)

    background = cv2.GaussianBlur(first[1], (5, 5), 0).astype(np.float32)
    ts_list = [first[0]]
    grids = [np.zeros((GRID_H, GRID_W), np.uint8)]
    last_report = 0.0
    for ts, img in samples:
        img = cv2.GaussianBlur(img, (5, 5), 0)
        moving = (cv2.absdiff(img, background.astype(np.uint8)) > diff_threshold).astype(np.float32)
        cells = cv2.resize(moving, (GRID_W, GRID_H), interpolation=cv2.INTER_AREA)
        grids.append((cells * 255).astype(np.uint8))
        ts_list.append(ts)
        cv2.accumulateWeighted(img, background, bg_alpha)
        if progress and ts - last_report > 30:
            progress(min(ts / duration, 0.999))
            last_report = ts

    mode = {"sampling": "keyframes" if step == 0 else f"{step:g}s",
            "keyframe_interval": kf, "hwaccel": hwaccel or "cpu"}
    return np.array(ts_list, np.float32), np.stack(grids), mode


# --- consultas sobre a grade ---------------------------------------------------

def roi_weights(roi):
    """Peso de cada celula = fracao da celula coberta pela ROI normalizada."""
    if not roi:
        return np.ones((GRID_H, GRID_W), np.float32)
    x, y, w, h = roi
    xs = np.arange(GRID_W, dtype=np.float32) / GRID_W
    ys = np.arange(GRID_H, dtype=np.float32) / GRID_H
    ox = np.clip(np.minimum(xs + 1 / GRID_W, x + w) - np.maximum(xs, x), 0, None) * GRID_W
    oy = np.clip(np.minimum(ys + 1 / GRID_H, y + h) - np.maximum(ys, y), 0, None) * GRID_H
    weights = np.outer(oy, ox)
    if weights.sum() == 0:
        return np.ones((GRID_H, GRID_W), np.float32)
    return weights


def roi_scores(grid, roi=None):
    w = roi_weights(roi)
    return (grid.astype(np.float32) * w).sum(axis=(1, 2)) / (w.sum() * 255.0)


def segments(ts, scores, threshold, duration, pad=1.0):
    if len(ts) < 2:
        return []
    interval = float(np.median(np.diff(ts)))
    merge_gap = max(3.0, 2.5 * interval)
    out = []
    for t, sc in zip(ts.tolist(), scores.tolist()):
        if sc < threshold:
            continue
        if out and t - out[-1]["end"] <= merge_gap:
            out[-1]["end"] = t
            out[-1]["peak"] = max(out[-1]["peak"], sc)
        else:
            out.append({"start": t, "end": t, "peak": sc})
    for s in out:
        s["start"] = max(0.0, s["start"] - max(pad, interval))
        s["end"] = min(duration, s["end"] + max(pad, interval))
    return out


def binned(ts, scores, duration, bins):
    """Maximo por faixa de tempo, para desenhar a timeline."""
    idx = np.minimum((ts / max(duration, 1e-6) * bins).astype(np.int64), bins - 1)
    out = np.zeros(bins, np.float32)
    np.maximum.at(out, idx, scores)
    return out
