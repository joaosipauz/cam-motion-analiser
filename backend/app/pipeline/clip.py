"""Exportacao de trechos e geracao de proxy tocavel no navegador."""
import subprocess

import av

from ..config import settings
from .decode import crop
from .enhance import check_size, get_upscaler


def run_ffmpeg(args, duration, progress=None):
    cmd = [settings.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
           "-progress", "pipe:1", "-nostats", *args]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    for line in proc.stdout:
        if progress and line.startswith("out_time_us=") and duration > 0:
            try:
                progress(min(int(line.split("=")[1]) / 1e6 / duration, 0.999))
            except ValueError:
                pass
    err = proc.stderr.read()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg falhou: {err.strip()[-500:]}")


def export_copy(src, start, end, out, progress=None):
    """Rapido: copia os pacotes, sem recodificar. O corte cai no keyframe anterior."""
    run_ffmpeg(["-ss", f"{start:.3f}", "-i", str(src), "-t", f"{end - start:.3f}",
                "-map", "0:v:0", "-map", "0:a?", "-c", "copy",
                "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", str(out)],
               end - start, progress)


def export_precise(src, start, end, out, progress=None):
    """Preciso: recodifica, corte exato no quadro."""
    run_ffmpeg(["-ss", f"{start:.3f}", "-i", str(src), "-t", f"{end - start:.3f}",
                "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac",
                "-movflags", "+faststart", str(out)],
               end - start, progress)


def export_enhanced(src, start, end, roi, out, progress=None, model="ia"):
    """Recorta a ROI, amplia 4x com IA quadro a quadro e codifica em H.264."""
    upscaler = get_upscaler(model)
    with av.open(str(src)) as inp, av.open(str(out), "w") as outp:
        s = inp.streams.video[0]
        s.thread_type = "AUTO"
        rate = s.average_rate or 15
        enc = None
        inp.seek(int(start / s.time_base), stream=s)
        for frame in inp.decode(s):
            if frame.pts is None:
                continue
            t = float(frame.pts * s.time_base)
            if t < start:
                continue
            if t > end:
                break
            region, _ = crop(frame.to_ndarray(format="rgb24"), roi)
            if enc is None:
                check_size(region.shape[1], region.shape[0])
                enc = outp.add_stream("libx264", rate=rate)
                enc.width, enc.height = region.shape[1] * 4, region.shape[0] * 4
                enc.pix_fmt = "yuv420p"
                enc.options = {"crf": "18", "preset": "veryfast"}
            big = upscaler(region)
            for pkt in enc.encode(av.VideoFrame.from_ndarray(big, format="rgb24")):
                outp.mux(pkt)
            if progress:
                progress(min((t - start) / max(end - start, 1e-6), 0.999))
        if enc is None:
            raise RuntimeError("Nenhum quadro no intervalo.")
        for pkt in enc.encode():
            outp.mux(pkt)


def make_proxy(src, info, out, progress=None):
    """Gera uma versao que o navegador consegue tocar (remux quando possivel)."""
    if info["codec"] in ("h264", "hevc"):
        args = ["-i", str(src), "-map", "0:v:0", "-map", "0:a?", "-c:v", "copy",
                "-c:a", "aac", "-movflags", "+faststart", str(out)]
    else:
        args = ["-i", str(src), "-map", "0:v:0", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
    run_ffmpeg(args, info["duration"], progress)
