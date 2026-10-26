"""Benchmark de melhoria de um recorte do quadro pausado.

Gera, para o recorte (ROI) no instante --time:
  bicubic.png  ampliacao simples (referencia)
  fiel.png     multi-quadro: alinha N quadros vizinhos e combina (sem inventar detalhe)
  ia.png       Real-ESRGAN compacto via OpenVINO (pode inventar detalhe)
  comparacao.png  os tres lado a lado

Uso:
  python bench/upscale_crop.py VIDEO --time 120 --roi 0.55,0.25,0.2,0.3
                               [--frames 15] [--device GPU] [--out saida/]
"""
import argparse
import os
import time

import av
import cv2
import numpy as np
import openvino as ov

SCALE = 4


def grab_frames(path, t, count):
    """Decodifica `count` quadros centrados no instante t (RGB, resolucao cheia)."""
    with av.open(path) as container:
        stream = container.streams.video[0]
        stream.thread_type = "AUTO"
        fps = float(stream.average_rate)
        start = max(0.0, t - count / 2 / fps)
        container.seek(int(start / stream.time_base), stream=stream)
        frames = []
        for frame in container.decode(stream):
            ts = float(frame.pts * stream.time_base)
            if ts < start:
                continue
            frames.append(frame.to_ndarray(format="rgb24"))
            if len(frames) == count:
                break
    return frames


def crop(img, roi):
    h, w = img.shape[:2]
    x, y, rw, rh = roi
    return img[int(y * h):int((y + rh) * h), int(x * w):int((x + rw) * w)]


def bicubic(img):
    return cv2.resize(img, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)


def multi_frame(crops, min_corr=0.85):
    """Alinha cada recorte ao central com precisao subpixel e tira a media.

    Quadros que nao alinham bem (objeto se movendo muito) sao descartados.
    """
    ref = crops[len(crops) // 2]
    ref_gray = cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY).astype(np.float32)
    big_ref = bicubic(ref).astype(np.float32)
    acc = big_ref.copy()
    used = 1
    criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 1e-4)
    for i, c in enumerate(crops):
        if i == len(crops) // 2:
            continue
        gray = cv2.cvtColor(c, cv2.COLOR_RGB2GRAY).astype(np.float32)
        warp = np.eye(2, 3, dtype=np.float32)
        try:
            corr, warp = cv2.findTransformECC(ref_gray, gray, warp, cv2.MOTION_EUCLIDEAN,
                                              criteria, None, 5)
        except cv2.error:
            continue
        if corr < min_corr:
            continue
        warp[:, 2] *= SCALE  # deslocamento medido em baixa resolucao
        big = bicubic(c).astype(np.float32)
        acc += cv2.warpAffine(big, warp, (big.shape[1], big.shape[0]),
                              flags=cv2.INTER_CUBIC + cv2.WARP_INVERSE_MAP,
                              borderMode=cv2.BORDER_REFLECT)
        used += 1
    fused = acc / used
    # a media suaviza; um unsharp leve recupera nitidez sem criar estrutura nova
    blur = cv2.GaussianBlur(fused, (0, 0), 1.5)
    sharp = cv2.addWeighted(fused, 1.6, blur, -0.6, 0)
    return np.clip(sharp, 0, 255).astype(np.uint8), used


class AiUpscaler:
    def __init__(self, model_path, device):
        self.core = ov.Core()
        self.model = self.core.read_model(model_path)
        self.device = device
        self.compiled = None
        self.shape = None

    def __call__(self, img):
        h, w = img.shape[:2]
        if self.shape != (h, w):
            # forma fixa por recorte: compila mais rapido e roda melhor na iGPU
            self.model.reshape([1, 3, h, w])
            self.compiled = self.core.compile_model(self.model, self.device)
            self.shape = (h, w)
        x = img.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
        y = self.compiled(x)[0][0]
        return np.clip(y.transpose(1, 2, 0) * 255.0, 0, 255).astype(np.uint8)


def label(img, text):
    out = img.copy()
    cv2.putText(out, text, (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
    cv2.putText(out, text, (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--time", type=float, required=True)
    ap.add_argument("--roi", required=True)
    ap.add_argument("--frames", type=int, default=15)
    ap.add_argument("--device", default="GPU")
    ap.add_argument("--model", default="models/realesr-general-x4v3.xml")
    ap.add_argument("--out", default="bench_out")
    args = ap.parse_args()
    roi = tuple(float(v) for v in args.roi.split(","))
    os.makedirs(args.out, exist_ok=True)

    t0 = time.perf_counter()
    frames = grab_frames(args.video, args.time, args.frames)
    crops = [crop(f, roi) for f in frames]
    ref = crops[len(crops) // 2]
    t_decode = time.perf_counter() - t0
    print(f"recorte {ref.shape[1]}x{ref.shape[0]} -> {ref.shape[1] * SCALE}x{ref.shape[0] * SCALE}")
    print(f"decodificar {len(frames)} quadros: {t_decode * 1000:.0f} ms")

    t0 = time.perf_counter()
    base = bicubic(ref)
    print(f"bicubico: {(time.perf_counter() - t0) * 1000:.0f} ms")

    t0 = time.perf_counter()
    fiel, used = multi_frame(crops)
    print(f"fiel (multi-quadro, {used}/{len(crops)} usados): {(time.perf_counter() - t0) * 1000:.0f} ms")

    up = AiUpscaler(args.model, args.device)
    t0 = time.perf_counter()
    ia = up(ref)
    t_first = time.perf_counter() - t0
    t0 = time.perf_counter()
    for _ in range(3):
        up(ref)
    t_steady = (time.perf_counter() - t0) / 3
    print(f"ia [{args.device}]: 1a chamada (com compilacao) {t_first * 1000:.0f} ms, "
          f"seguintes {t_steady * 1000:.0f} ms")
    clip_s = 10 * 15 * t_steady
    print(f"estimativa trecho 10s @15fps neste recorte: {clip_s / 60:.1f} min")

    save = lambda name, img: cv2.imwrite(os.path.join(args.out, name),
                                         cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    save("bicubic.png", base)
    save("fiel.png", fiel)
    save("ia.png", ia)
    save("comparacao.png", np.hstack([label(base, "bicubico"), label(fiel, "fiel"),
                                      label(ia, "IA")]))
    print("imagens em", os.path.abspath(args.out))


if __name__ == "__main__":
    main()
