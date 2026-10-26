# Cam Motion Analiser

Análise local de gravações de câmeras de segurança: timeline de movimento, filtro por área,
melhoria de quadros (placas, rostos) e exportação de trechos. Tudo roda na sua máquina.

## Instalação (Docker)

```bash
CMA_VIDEOS=/caminho/das/gravacoes docker compose up -d
```

Abra http://localhost:8971. As pastas de vídeos são cadastradas na própria interface
("Seus vídeos" → "Adicionar pasta de vídeos"); `CMA_MEDIA_DIR` vira só a primeira pasta da lista.
No Docker, o seletor enxerga o sistema de arquivos do container: monte cada pasta de gravações
como volume (ex.: `- /mnt/dvr:/media/dvr:ro`) e escolha-a dentro de `/media`. Em Linux com GPU integrada Intel, descomente `devices: /dev/dri`
no `docker-compose.yml` para acelerar a decodificação (VAAPI) e a IA (OpenVINO).

## Como funciona

- **Varredura**: decodifica só os keyframes (ou 1 quadro/s se a câmera tiver GOP longo),
  em 320 px cinza, contra um fundo adaptativo. Guarda uma grade 32x18 de movimento por amostra
  em `data/analyses/<id>.npz`.
- **Área e sensibilidade**: recalculadas sobre a grade em milissegundos, sem nova varredura.
- **Melhoria 4x** do recorte selecionado (todos via OpenVINO):
  - *Fiel*: alinha ~15 quadros vizinhos por fluxo óptico e combina pela mediana; não inventa detalhes.
  - *IA forte* (padrão): Real-ESRGAN x4plus (BSD-3), ~1–2 s por recorte na iGPU.
  - *SwinIR*: SwinIR-M real GAN (Apache-2.0), em blocos de 64 px na CPU (mais rápida que a iGPU para esse modelo).
  - *IA rápida*: Real-ESRGAN compacto (`realesr-general-x4v3`, BSD-3).
  - Os modos de IA podem criar detalhes falsos. O PNG exportado leva os metadados (horário, área, modo).
  - **Seletor de quadros**: ao melhorar, o app mede a nitidez da área (variância do Laplaciano) em ±2 s
    e oferece os 4 quadros mais nítidos além do pausado.
  - Restauração facial (GFPGAN/CodeFormer) foi descartada: gera um rosto plausível que não é o da pessoa.
- **Exportação**: rápida (cópia, corta no keyframe), exata (recodifica) ou com melhoria IA da seleção.
- **Worker**: processo separado consumindo uma fila de jobs no SQLite (retoma jobs após queda).

## Estrutura

```
backend/app/
  main.py          API + frontend estático + inicia o worker
  config.py        variáveis CMA_*
  db.py            SQLite (WAL): videos, jobs
  api/             videos.py (biblioteca, stream, timeline), media.py (melhoria, exportação, jobs)
  pipeline/        decode, motion, enhance, clip, timestamps
  worker/runner.py fila de jobs
frontend/src/      React + Vite (player, timeline em canvas, seleção, melhoria, exportação)
bench/             benchmarks e conversão do modelo
```

## Desenvolvimento (sem Docker)

Requisitos: Python 3.12, Node 22, FFmpeg.

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r backend/requirements.txt spandrel torch --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
```

Modelos de IA (uma vez; baixe os `.pth` dos links no `Dockerfile` para `models/`):

```bash
.venv/Scripts/python bench/convert_model.py models/realesr-general-x4v3.pth models/realesr-general-x4v3.xml
```

```bash
.venv/Scripts/python bench/convert_model.py models/RealESRGAN_x4plus.pth models/realesrgan-x4plus.xml
```

```bash
.venv/Scripts/python bench/convert_model.py models/003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth models/swinir-m-x4-gan.xml --tile 64
```

Backend (porta 8971), apontando para a pasta de vídeos:

```bash
cd backend && CMA_MEDIA_DIR=~/Videos ../.venv/Scripts/python -m uvicorn app.main:app --port 8971
```

Interface com recarga automática (porta 5173, repassa `/api` para o backend):

```bash
cd frontend && npm install && npm run dev
```

Variáveis: `CMA_MEDIA_DIR`, `CMA_DATA_DIR`, `CMA_MODEL_DIR`, `CMA_STATIC_DIR`,
`CMA_HWACCEL` (`auto`/`dxva2`/`d3d11va`/`vaapi`/`none`), `CMA_OV_DEVICE` (`AUTO`/`GPU`/`CPU`),
`CMA_FFMPEG`, `CMA_WORKER` (`0` desliga o worker).

## Atalhos

Espaço play/pausa · ←/→ 5 s (Shift 60 s) · `,` `.` quadro a quadro · N/P próximo/anterior evento ·
I/O marcar trecho · S selecionar área · Esc limpar seleção · roda do mouse no vídeo: zoom.
