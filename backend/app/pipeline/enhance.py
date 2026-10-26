"""Melhoria de recortes.

Modos:
  bicubic   ampliacao simples
  fiel      combina quadros vizinhos alinhados por fluxo optico (nao inventa detalhe)
  ia        Real-ESRGAN compacto: rapido (pode inventar detalhe)
  ia_forte  Real-ESRGAN x4plus: mais nitido, ~1-2 s por recorte na iGPU
  swinir    SwinIR real GAN: alternativa ao x4plus, roda em blocos na CPU
"""
import threading

import cv2
import numpy as np
import openvino as ov

from ..config import settings

SCALE = 4
MAX_INPUT_PIXELS = 640 * 640

# device None = settings.ov_device. SwinIR (atencao em janelas) roda mais rapido
# na CPU do que na UHD 630; modelos de entrada fixa sao processados em blocos.
AI_MODELS = {
    "ia": {"file": "realesr-general-x4v3.xml", "device": None},
    "ia_forte": {"file": "realesrgan-x4plus.xml", "device": None},
    "swinir": {"file": "swinir-m-x4-gan.xml", "device": "CPU"},
}
TILE_OVERLAP = 8
SHAPE_BUCKET = 32


def bicubic(img):
    return cv2.resize(img, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_CUBIC)


def _unsharp(img, amount=0.6, sigma=1.5):
    blur = cv2.GaussianBlur(img, (0, 0), sigma)
    return cv2.addWeighted(img, 1 + amount, blur, -amount, 0)


def faithful(crops, mid, max_error=18):
    """Super-resolucao multi-quadro.

    Cada recorte vizinho e alinhado ao de referencia (indice `mid`) com fluxo optico
    denso (lida com pessoas e veiculos em movimento) e ampliado; pixels que nao
    alinham sao substituidos pela referencia; a mediana descarta o que sobrar de fantasma.
    """
    ref = crops[mid]
    ref_g = cv2.cvtColor(ref, cv2.COLOR_RGB2GRAY)
    big_ref = bicubic(ref).astype(np.float32)
    h, w = ref_g.shape
    H, W = h * SCALE, w * SCALE
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    lx, ly = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)

    stack = [big_ref]
    for i, c in enumerate(crops):
        if i == mid:
            continue
        g = cv2.cvtColor(c, cv2.COLOR_RGB2GRAY)
        flow = dis.calc(ref_g, g, None)
        low = cv2.remap(g, lx + flow[..., 0], ly + flow[..., 1], cv2.INTER_LINEAR,
                        borderMode=cv2.BORDER_REFLECT)
        bad = cv2.absdiff(low, ref_g) > max_error
        big_flow = cv2.resize(flow, (W, H), interpolation=cv2.INTER_LINEAR) * SCALE
        warped = cv2.remap(bicubic(c).astype(np.float32), gx + big_flow[..., 0],
                           gy + big_flow[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
        bad_big = cv2.resize(bad.astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST) > 0
        warped[bad_big] = big_ref[bad_big]
        stack.append(warped)

    fused = np.median(np.stack(stack), axis=0)
    return np.clip(_unsharp(fused), 0, 255).astype(np.uint8)


_core = None


def _get_core():
    global _core
    if _core is None:
        _core = ov.Core()
        _core.set_property({"CACHE_DIR": str(settings.cache_dir / "openvino")})
    return _core


class AiUpscaler:
    """Modelo OpenVINO 4x.

    Entrada dinamica: compila um modelo por tamanho de recorte (o cache do OpenVINO
    evita recompilar). Entrada fixa: processa em blocos sobrepostos e mescla as bordas.
    """

    def __init__(self, name):
        spec = AI_MODELS[name]
        self.core = _get_core()
        self.device = spec["device"] or settings.ov_device
        if self.device == "AUTO":
            self.device = "GPU" if "GPU" in self.core.available_devices else "CPU"
        self.model_path = settings.model_dir / spec["file"]
        self.tile = None
        self._model = None
        self._compiled = {}
        self._lock = threading.Lock()

    @property
    def available(self):
        return self.model_path.exists()

    def _load(self):
        if self._model is None:
            self._model = self.core.read_model(self.model_path)
            shape = self._model.input().partial_shape
            if shape.is_static:
                self.tile = shape[2].get_length()

    def _get(self, h, w):
        key = (h, w)
        if key not in self._compiled:
            if len(self._compiled) > 16:
                self._compiled.clear()
            model = self._model
            if self.tile is None:
                model = self.core.read_model(self.model_path)
                model.reshape([1, 3, h, w])
            self._compiled[key] = self.core.compile_model(model, self.device)
        return self._compiled[key]

    def _infer(self, img):
        compiled = self._get(*img.shape[:2])
        x = img.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
        return compiled(x)[0][0].transpose(1, 2, 0)

    def _tiled(self, img):
        T, s = self.tile, SCALE
        h, w = img.shape[:2]
        H, W = max(h, T), max(w, T)
        padded = np.pad(img, ((0, H - h), (0, W - w), (0, 0)), mode="symmetric")
        step = T - 2 * TILE_OVERLAP
        ys = sorted({*range(0, H - T, step), H - T})
        xs = sorted({*range(0, W - T, step), W - T})
        ramp = np.minimum(np.arange(T * s) + 1, np.arange(T * s)[::-1] + 1)
        ramp = np.minimum(ramp, TILE_OVERLAP * s).astype(np.float32)
        mask = np.outer(ramp, ramp)[..., None]
        out = np.zeros((H * s, W * s, 3), np.float32)
        weight = np.zeros((H * s, W * s, 1), np.float32)
        for y in ys:
            for x in xs:
                tile = self._infer(padded[y:y + T, x:x + T])
                out[y * s:(y + T) * s, x * s:(x + T) * s] += tile * mask
                weight[y * s:(y + T) * s, x * s:(x + T) * s] += mask
        return (out / weight)[:h * s, :w * s]

    def _bucketed(self, img):
        """Arredonda o recorte para multiplos de SHAPE_BUCKET: tamanhos parecidos
        reaproveitam o modelo ja compilado em vez de compilar de novo (~3 s)."""
        h, w = img.shape[:2]
        H = -(-h // SHAPE_BUCKET) * SHAPE_BUCKET
        W = -(-w // SHAPE_BUCKET) * SHAPE_BUCKET
        padded = np.pad(img, ((0, H - h), (0, W - w), (0, 0)), mode="symmetric")
        return self._infer(padded)[:h * SCALE, :w * SCALE]

    def __call__(self, img):
        with self._lock:
            self._load()
            y = self._tiled(img) if self.tile else self._bucketed(img)
        return np.clip(y * 255.0, 0, 255).astype(np.uint8)


_upscalers = {}


def get_upscaler(name="ia"):
    if name not in _upscalers:
        _upscalers[name] = AiUpscaler(name)
    return _upscalers[name]


def sharpness(img):
    """Variancia do Laplaciano: quanto maior, mais nitido o recorte."""
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def check_size(w, h):
    if w * h > MAX_INPUT_PIXELS:
        raise ValueError("Area muito grande para ampliar 4x; selecione uma regiao menor.")
    if w < 8 or h < 8:
        raise ValueError("Area muito pequena.")
