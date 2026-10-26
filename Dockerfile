# Imagem unica (API + worker + interface), no estilo Frigate.

# --- 1. interface ------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- 2. modelos de IA: PyTorch so existe neste estagio -------------------------
FROM python:3.12-slim-bookworm AS model
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "openvino==2026.*" spandrel
ADD https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth /models/
ADD https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth /models/
ADD https://github.com/JingyunLiang/SwinIR/releases/download/v0.0/003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth /models/
COPY bench/convert_model.py /convert.py
RUN cd /models \
 && python /convert.py realesr-general-x4v3.pth realesr-general-x4v3.xml \
 && python /convert.py RealESRGAN_x4plus.pth realesrgan-x4plus.xml \
 && python /convert.py 003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth swinir-m-x4-gan.xml --tile 64 \
 && rm *.pth

# --- 3. runtime ----------------------------------------------------------------
FROM python:3.12-slim-bookworm
# ffmpeg + drivers Intel: VAAPI (decodificacao) e OpenCL (OpenVINO na iGPU)
RUN sed -i 's/^Components: main$/Components: main contrib non-free non-free-firmware/' \
      /etc/apt/sources.list.d/debian.sources \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg intel-media-va-driver-non-free i965-va-driver intel-opencl-icd vainfo \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend /src/dist frontend/dist
COPY --from=model /models models

ENV CMA_MEDIA_DIR=/media \
    CMA_DATA_DIR=/data \
    CMA_MODEL_DIR=/app/models \
    CMA_STATIC_DIR=/app/frontend/dist \
    PYTHONUNBUFFERED=1

VOLUME /data
EXPOSE 8971
WORKDIR /app/backend
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8971/api/health')"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8971"]
