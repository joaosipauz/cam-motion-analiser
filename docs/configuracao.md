# Configuração

[← Voltar ao início](../README.md)

## Arquivo `.env`

Lido automaticamente pelo `docker compose`. Copie de `.env.example`.

| Variável | Padrão | Para que serve |
|---|---|---|
| `CMA_VIDEOS` | `./videos` | Pasta com as gravações. Aparece no app como `media/gravacoes`, somente leitura. |
| `CMA_DATA` | `./data` | Onde o app guarda banco, análises, trechos salvos e caches. |
| `CMA_PORT` | `8971` | Porta da interface no seu computador. |

No Windows, escreva os caminhos com barras normais: `D:/Gravacoes`.

## Variáveis do app

Definidas em `environment` no `docker-compose.yml` (ou no terminal, ao [rodar sem Docker](sem-docker.md)).
Todas são opcionais.

| Variável | Padrão | Para que serve |
|---|---|---|
| `CMA_HWACCEL` | `auto` | Decodificação por hardware: `auto`, `vaapi` (Linux), `dxva2` ou `d3d11va` (Windows), `none` (só CPU). Em `auto` o app escolhe e, se a GPU falhar, usa a CPU. |
| `CMA_OV_DEVICE` | `AUTO` | Onde rodar os modelos de IA: `AUTO` (GPU se houver), `GPU` ou `CPU`. O modo SwinIR roda sempre na CPU, que é mais rápida para ele. |
| `CMA_MEDIA_DIR` | `/media` | Pasta cadastrada automaticamente na primeira execução, se existir. Outras pastas são cadastradas pela interface. |
| `CMA_DATA_DIR` | `/data` no Docker, `data/` fora dele | Pasta de dados dentro do app. No Docker, prefira mudar `CMA_DATA` no `.env`. |
| `CMA_MODEL_DIR` | `/app/models` no Docker, `models/` fora dele | Modelos de IA convertidos. |
| `CMA_FFMPEG` | `ffmpeg` | Caminho do executável do FFmpeg. |
| `CMA_WORKER` | `1` | `0` desliga o processamento em segundo plano (busca por movimentos e trechos salvos). |

## Exemplo completo de `docker-compose.yml`

Linux com GPU integrada Intel e duas pastas de câmeras:

```yaml
services:
  cam-motion-analiser:
    build: .
    image: cam-motion-analiser:latest
    container_name: cam-motion-analiser
    restart: unless-stopped
    ports:
      - "8971:8971"
    volumes:
      - /mnt/dvr/loja:/media/loja:ro
      - /mnt/dvr/garagem:/media/garagem:ro
      - ./data:/data
    environment:
      CMA_HWACCEL: auto
      CMA_OV_DEVICE: AUTO
    devices:
      - /dev/dri:/dev/dri
```
