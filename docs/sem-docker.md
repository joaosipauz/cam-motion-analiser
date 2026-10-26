# Rodar sem Docker

[← Voltar ao início](../README.md)

Instalação direta no computador. No Windows, é o jeito de usar a GPU integrada Intel, que o Docker Desktop
não repassa para o container. Também é o caminho para quem vai mexer no código.

- [Requisitos](#requisitos)
- [Windows](#windows)
- [Linux](#linux)
- [Modelos de IA](#modelos-de-ia)
- [Desenvolvendo a interface](#desenvolvendo-a-interface)

## Requisitos

| | Versão |
|---|---|
| Python | 3.12 |
| Node.js | 18 ou mais novo (testado com 22), só para compilar a interface |
| FFmpeg | qualquer versão recente |
| Git | para baixar o projeto |

## Windows

Comandos para o **PowerShell**.

### 1. Instalar as ferramentas (uma vez)

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install Git.Git
```

Feche e abra o PowerShell depois de instalar, para os programas entrarem no PATH.

### 2. Baixar o projeto e instalar as dependências

```powershell
git clone https://github.com/joaosipauz/cam-motion-analiser.git
cd cam-motion-analiser
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

### 3. Compilar a interface

```powershell
cd frontend
npm ci
npm run build
cd ..
```

### 4. Modelos de IA (opcional)

Veja [Modelos de IA](#modelos-de-ia). Sem eles o app funciona; só os modos de IA da melhoria de imagem
ficam indisponíveis.

### 5. Iniciar

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8971
```

Abra **http://localhost:8971** e cadastre a pasta das gravações em **Adicionar pasta de vídeos**.
Para parar, `Ctrl+C`.

Se aparecer erro de FFmpeg ao salvar trechos, informe o caminho dele antes de iniciar:

```powershell
$env:CMA_FFMPEG = "C:\caminho\para\ffmpeg.exe"
```

## Linux

```bash
sudo apt install python3.12 python3.12-venv ffmpeg nodejs npm git
git clone https://github.com/joaosipauz/cam-motion-analiser.git
cd cam-motion-analiser
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
(cd frontend && npm ci && npm run build)
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8971
```

Para usar a GPU integrada Intel, instale os drivers de VAAPI e OpenCL
(no Debian/Ubuntu: `intel-media-va-driver-non-free` e `intel-opencl-icd`).

## Modelos de IA

Baixados uma vez e convertidos para o formato do OpenVINO. O PyTorch é usado só nessa conversão
(cerca de 200 MB de download). No Linux, troque `.\.venv\Scripts\python` por `.venv/bin/python`,
`curl.exe` por `curl` e `\` por `/`.

```powershell
.\.venv\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python -m pip install spandrel
mkdir models
curl.exe -L -o models\realesr-general-x4v3.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
curl.exe -L -o models\RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
curl.exe -L -o models\swinir.pth https://github.com/JingyunLiang/SwinIR/releases/download/v0.0/003_realSR_BSRGAN_DFO_s64w8_SwinIR-M_x4_GAN.pth
.\.venv\Scripts\python bench\convert_model.py models\realesr-general-x4v3.pth models\realesr-general-x4v3.xml
.\.venv\Scripts\python bench\convert_model.py models\RealESRGAN_x4plus.pth models\realesrgan-x4plus.xml
.\.venv\Scripts\python bench\convert_model.py models\swinir.pth models\swinir-m-x4-gan.xml --tile 64
```

## Desenvolvendo a interface

Com o backend rodando na porta 8971, a interface pode rodar com recarga automática na porta 5173
(as chamadas para `/api` são repassadas ao backend):

```bash
cd frontend
npm run dev
```

Detalhes da arquitetura em [Como funciona](como-funciona.md).
