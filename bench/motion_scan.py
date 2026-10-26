"""Benchmark da varredura de movimento.

Modos:
  keyframes  decodifica apenas keyframes (passada rapida, padrao do MVP)
  sampled    decodifica todos os quadros e analisa N por segundo (baseline)

Uso:
  python bench/motion_scan.py VIDEO [--mode keyframes|sampled] [--fps 5]
                              [--width 320] [--roi x,y,w,h] [--json saida.json]

ROI em coordenadas normalizadas (0..1), ex: --roi 0.5,0.4,0.5,0.6
"""
import argparse
import json
import time

import av
import cv2
from av.codec.hwaccel import HWAccel
import numpy as np


def parse_roi(text):
    if not text:
        return None
    x, y, w, h = (float(v) for v in text.split(","))
    return x, y, w, h


def iter_gray_frames(path, mode, fps, width, hwaccel=None):
    """Gera (timestamp_s, frame_gray_reduzido)."""
    kw = {"hwaccel": HWAccel(device_type=hwaccel)} if hwaccel else {}
    with av.open(path, **kw) as container:
        stream = container.streams.video[0]
        if not hwaccel:
            stream.thread_type = "AUTO"
        if mode == "keyframes":
            stream.codec_context.skip_frame = "NONKEY"
        height = round(stream.height * width / stream.width / 2) * 2
        step = 1.0 / fps if mode == "sampled" else 0.0
        next_ts = 0.0
        for frame in container.decode(stream):
            if frame.pts is None:
                continue
            ts = float(frame.pts * stream.time_base)
            if ts < next_ts:
                continue
            next_ts = ts + step
            # swscale reduz e converte para cinza num passo so
            img = frame.reformat(width=width, height=height, format="gray").to_ndarray()
            yield ts, img


def motion_scores(frames, roi, diff_threshold=25, bg_alpha=0.05):
    """Fracao de pixels em movimento por amostra, contra um fundo adaptativo."""
    background = None
    mask = None
    for ts, img in frames:
        img = cv2.GaussianBlur(img, (5, 5), 0)
        if background is None:
            background = img.astype(np.float32)
            h, w = img.shape
            mask = np.zeros((h, w), np.uint8)
            if roi:
                x, y, rw, rh = roi
                mask[int(y * h):int((y + rh) * h), int(x * w):int((x + rw) * w)] = 1
            else:
                mask[:] = 1
            area = int(mask.sum())
            yield ts, 0.0
            continue
        diff = cv2.absdiff(img, background.astype(np.uint8))
        moving = (diff > diff_threshold) & (mask == 1)
        yield ts, float(moving.sum()) / area
        cv2.accumulateWeighted(img, background, bg_alpha)


def to_segments(scores, threshold=0.01, merge_gap=3.0, pad=1.0):
    """Agrupa amostras acima do limiar em intervalos [inicio, fim]."""
    segments = []
    for ts, score in scores:
        if score < threshold:
            continue
        if segments and ts - segments[-1]["end"] <= merge_gap:
            segments[-1]["end"] = ts
            segments[-1]["peak"] = max(segments[-1]["peak"], score)
        else:
            segments.append({"start": ts, "end": ts, "peak": score})
    for s in segments:
        s["start"] = max(0.0, s["start"] - pad)
        s["end"] += pad
    return segments


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--mode", choices=["keyframes", "sampled"], default="keyframes")
    ap.add_argument("--fps", type=float, default=5.0)
    ap.add_argument("--width", type=int, default=320)
    ap.add_argument("--roi")
    ap.add_argument("--threshold", type=float, default=0.01)
    ap.add_argument("--hwaccel", help="dxva2/d3d11va (Windows) ou vaapi (Linux)")
    ap.add_argument("--json")
    args = ap.parse_args()

    with av.open(args.video) as c:
        duration = float(c.duration / av.time_base)

    t0 = time.perf_counter()
    frames = iter_gray_frames(args.video, args.mode, args.fps, args.width, args.hwaccel)
    scores = list(motion_scores(frames, parse_roi(args.roi)))
    elapsed = time.perf_counter() - t0
    segments = to_segments(scores, args.threshold)

    moving_s = sum(s["end"] - s["start"] for s in segments)
    speed = duration / elapsed
    print(f"modo={args.mode} hw={args.hwaccel or 'cpu'} amostras={len(scores)} duracao_video={duration:.0f}s")
    print(f"tempo={elapsed:.2f}s  velocidade={speed:.0f}x tempo real")
    print(f"estimativa para 12h: {12 * 3600 / speed / 60:.1f} min")
    print(f"segmentos={len(segments)}  tempo_com_movimento={moving_s:.0f}s "
          f"({100 * moving_s / duration:.0f}%)")

    if args.json:
        with open(args.json, "w") as f:
            json.dump({"duration": duration, "scores": scores, "segments": segments}, f)


if __name__ == "__main__":
    main()
