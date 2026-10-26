"""Compara metodos de melhoria num mesmo recorte.

Uso:
  python bench/enhance_compare.py VIDEO --time 25.01 --roi x,y,w,h [--face cx,cy,size] [--out dir]

--face: centro e tamanho (px do video) de um rosto para testar restauracao facial.
"""
import argparse
import os
import sys
import time

import cv2
import numpy as np
import torch
from spandrel import ModelLoader

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.pipeline.decode import crop, grab_frames  # noqa: E402

MODELS = "models/candidates"
torch.set_num_threads(os.cpu_count())


def load(name):
    m = ModelLoader().load_from_file(os.path.join(MODELS, name))
    m.eval()
    return m


def run(model, img):
    x = torch.from_numpy(img).permute(2, 0, 1)[None].float() / 255.0
    with torch.no_grad():
        y = model(x)
    if isinstance(y, (tuple, list)):
        y = y[0]
    return (y[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)


def temporal_fuse(frames, mid):
    """Alinha quadros vizinhos ao central (fluxo optico) e tira a mediana.

    Na resolucao original: remove ruido e blocos de compressao sem ampliar.
    """
    ref = frames[mid]
    ref_g = cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY)
    h, w = ref_g.shape
    gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    stack = [ref.astype(np.float32)]
    for i, f in enumerate(frames):
        if i == mid:
            continue
        g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        flow = dis.calc(ref_g, g, None)
        warped = cv2.remap(f, gx + flow[..., 0], gy + flow[..., 1], cv2.INTER_CUBIC,
                           borderMode=cv2.BORDER_REFLECT).astype(np.float32)
        bad = cv2.absdiff(cv2.cvtColor(warped.astype(np.uint8), cv2.COLOR_RGB2GRAY), ref_g) > 20
        warped[bad] = ref.astype(np.float32)[bad]
        stack.append(warped)
    return np.median(np.stack(stack), axis=0).astype(np.uint8)


def label(img, text):
    out = img.copy()
    cv2.rectangle(out, (0, 0), (out.shape[1], 30), (0, 0, 0), -1)
    cv2.putText(out, text, (6, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    return out


def grid(tiles, cols):
    h = max(t.shape[0] for t in tiles)
    w = max(t.shape[1] for t in tiles)
    tiles = [cv2.copyMakeBorder(t, 0, h - t.shape[0], 0, w - t.shape[1], cv2.BORDER_CONSTANT) for t in tiles]
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    return np.vstack(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--time", type=float, required=True)
    ap.add_argument("--roi", required=True)
    ap.add_argument("--face")
    ap.add_argument("--frames", type=int, default=9)
    ap.add_argument("--out", default="bench_out/compare")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    roi = tuple(float(v) for v in args.roi.split(","))

    full, mid = grab_frames(args.video, args.time, args.frames)
    crops = [crop(f, roi)[0] for f in full]
    src = crops[mid]
    fused = temporal_fuse(crops, mid)
    print(f"recorte {src.shape[1]}x{src.shape[0]}, {len(crops)} quadros")

    results = [("bicubico (Original)", cv2.resize(src, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC))]
    candidates = [
        ("general-x4v3 (IA atual)", "../realesr-general-x4v3.pth"),
        ("general-wdn-x4v3 (denoise)", "realesr-general-wdn-x4v3.pth"),
        ("RealESRGAN x4plus", "RealESRGAN_x4plus.pth"),
        ("BSRGAN", "BSRGAN.pth"),
        ("SwinIR-M real GAN", "SwinIR-M_x4_GAN.pth"),
    ]
    loaded = {}
    for name, file in candidates:
        try:
            m = loaded[file] = load(file)
        except Exception as e:
            print(f"{name}: falhou ao carregar ({e})")
            continue
        t0 = time.perf_counter()
        out = run(m, src)
        print(f"{name}: {time.perf_counter() - t0:.2f}s (CPU/torch)")
        results.append((name, out))

    # multi-quadro + IA: limpa compressao primeiro, depois amplia
    for name, file in (("multi-quadro + x4plus", "RealESRGAN_x4plus.pth"),
                       ("multi-quadro + SwinIR", "SwinIR-M_x4_GAN.pth")):
        if file in loaded:
            t0 = time.perf_counter()
            results.append((name, run(loaded[file], fused)))
            print(f"{name}: {time.perf_counter() - t0:.2f}s")

    for name, img in results:
        safe = name.split(" (")[0].replace(" ", "_").replace("+", "mais")
        cv2.imwrite(os.path.join(args.out, f"{safe}.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    sheet = grid([label(img, n) for n, img in results], 3)
    cv2.imwrite(os.path.join(args.out, "comparacao.png"), cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))

    if args.face:
        cx, cy, size = (int(v) for v in args.face.split(","))
        h0 = size // 2
        frames_face = [f[cy - h0:cy + h0, cx - h0:cx + h0] for f in full]
        face = frames_face[mid]
        face_fused = temporal_fuse(frames_face, mid)
        gfp = load("GFPGANv1.4.pth")
        x4 = loaded.get("RealESRGAN_x4plus.pth") or load("RealESRGAN_x4plus.pth")
        tiles = [("rosto bicubico", cv2.resize(face, (512, 512), interpolation=cv2.INTER_CUBIC))]
        for tag, base in (("", face), (" multi-quadro", face_fused)):
            up = cv2.resize(run(x4, base), (512, 512), interpolation=cv2.INTER_CUBIC)
            tiles.append((f"x4plus{tag}", up))
            t0 = time.perf_counter()
            restored = run(gfp, up)
            print(f"GFPGAN{tag}: {time.perf_counter() - t0:.2f}s")
            tiles.append((f"GFPGAN{tag} (gera rosto!)", restored))
        sheet = grid([label(img, n) for n, img in tiles], 5)
        cv2.imwrite(os.path.join(args.out, "rosto.png"), cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))
    print("saida em", os.path.abspath(args.out))


if __name__ == "__main__":
    main()
