# Instalação com Docker

[← Voltar ao início](../README.md)

O app roda numa imagem Docker única, no estilo do Frigate: a interface, a API e o processamento
ficam no mesmo container. Você aponta a pasta das gravações, e o resto acontece dentro dele.

- [1. Instalar o Docker](#1-instalar-o-docker)
- [2. Baixar o projeto](#2-baixar-o-projeto)
- [3. Escolher a pasta das gravações](#3-escolher-a-pasta-das-gravações)
- [4. Construir e iniciar](#4-construir-e-iniciar)
- [5. Abrir o app](#5-abrir-o-app)
- [Usar a GPU integrada Intel (Linux)](#usar-a-gpu-integrada-intel-linux)
- [Várias pastas de câmeras](#várias-pastas-de-câmeras)
- [Parar, iniciar e ver os registros](#parar-iniciar-e-ver-os-registros)
- [Atualizar para uma versão nova](#atualizar-para-uma-versão-nova)
- [Onde ficam os dados e como fazer backup](#onde-ficam-os-dados-e-como-fazer-backup)
- [Desinstalar](#desinstalar)

## 1. Instalar o Docker

| Sistema | O que instalar |
|---|---|
| Linux | [Docker Engine](https://docs.docker.com/engine/install/) com o plugin Compose |
| Windows 10/11 | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) (usa o WSL 2) |
| macOS | [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) |

Para conferir se está tudo certo:

```bash
docker compose version
```

**Qual escolher?** O app fica bem mais rápido no **Linux com GPU integrada Intel**, porque o container
consegue usar a GPU para decodificar o vídeo e rodar a IA. No Windows e no Mac, o Docker Desktop
não repassa a GPU integrada para o container, então tudo roda na CPU. Funciona, mas a busca por
movimentos fica de 3 a 5 vezes mais lenta. No Windows, rodar [sem Docker](sem-docker.md) usa a GPU.

## 2. Baixar o projeto

```bash
git clone https://github.com/joaosipauz/cam-motion-analiser.git
cd cam-motion-analiser
```

Sem o Git, baixe o ZIP pelo botão **Code → Download ZIP** no GitHub e extraia.

## 3. Escolher a pasta das gravações

Copie o arquivo de exemplo de configuração:

```bash
cp .env.example .env
```

No Windows (PowerShell), use `copy .env.example .env`.

Abra o `.env` num editor de texto e troque `CMA_VIDEOS` pela pasta onde ficam as gravações:

```ini
# Linux
CMA_VIDEOS=/mnt/dvr/gravacoes

# Windows: use barras normais
CMA_VIDEOS=D:/Gravacoes
```

A pasta é montada **somente para leitura**: o app não consegue alterar nem apagar nada nela.

## 4. Construir e iniciar

Na pasta do projeto:

```bash
docker compose up -d --build
```

Na primeira vez o Docker:

1. compila a interface;
2. baixa os modelos de IA (Real-ESRGAN e SwinIR, cerca de 140 MB) e converte para o formato do OpenVINO;
3. monta a imagem final com Python, FFmpeg e os drivers da GPU Intel.

Isso leva de 5 a 15 minutos, dependendo da internet. As próximas vezes são rápidas. Depois de
construída, a imagem funciona sem internet.

## 5. Abrir o app

Acesse **http://localhost:8971** no Chrome ou no Edge.

1. Clique em **Abrir pasta de vídeos**.
2. A pasta `media` já vem cadastrada. Entre em `gravacoes` e clique num vídeo.
3. A busca por movimentos começa sozinha; você já pode assistir enquanto ela roda.

Veja o que dá para fazer em [Usando o app](uso.md).

Para acessar de outro computador da rede, use o IP da máquina, por exemplo `http://192.168.0.10:8971`.
O app não tem login: só exponha a porta numa rede em que você confia.

## Usar a GPU integrada Intel (Linux)

Funciona com GPUs integradas Intel da 6ª geração (Skylake) em diante, como a UHD 630.

1. Confira se o dispositivo existe no computador:

   ```bash
   ls /dev/dri
   ```

   Deve aparecer algo como `card0` e `renderD128`.

2. No `docker-compose.yml`, apague o `#` destas linhas:

   ```yaml
   devices:
     - /dev/dri:/dev/dri
   ```

3. Recrie o container:

   ```bash
   docker compose up -d
   ```

Com isso o app tenta decodificar o vídeo pela GPU (VAAPI) e rodar os modelos de IA nela (OpenVINO).
Se a GPU não estiver disponível, ele usa a CPU sozinho, sem erro. Para forçar só a CPU, troque `CMA_HWACCEL: auto` por `none` e `CMA_OV_DEVICE: AUTO` por `CPU`.

## Várias pastas de câmeras

Tudo que estiver dentro de `/media` no container aparece no app. Para mais pastas, acrescente
linhas em `volumes` no `docker-compose.yml`, cada uma com um nome diferente depois de `/media/`:

```yaml
    volumes:
      - ${CMA_VIDEOS:-./videos}:/media/gravacoes:ro
      - /mnt/dvr-garagem:/media/garagem:ro
      - /mnt/dvr-loja:/media/loja:ro
      - ${CMA_DATA:-./data}:/data
```

Depois rode `docker compose up -d`. As pastas aparecem dentro de `media` no app.
Também dá para cadastrar uma pasta separada pela própria interface (**Adicionar pasta de vídeos**),
mas dentro do Docker ela só enxerga o que estiver montado no container.

## Parar, iniciar e ver os registros

| Ação | Comando |
|---|---|
| Parar | `docker compose stop` |
| Iniciar de novo | `docker compose start` |
| Ver os registros (logs) | `docker compose logs -f` |
| Ver se está rodando | `docker compose ps` |

O container volta sozinho quando o computador reinicia (`restart: unless-stopped`).
Uma busca por movimentos interrompida recomeça sozinha quando o app volta.

## Atualizar para uma versão nova

```bash
git pull
docker compose up -d --build
```

As análises, favoritos e pastas cadastradas ficam guardados em `data/` e são mantidos.

## Onde ficam os dados e como fazer backup

Tudo que o app cria fica na pasta `data/` do projeto (ou na que você definir em `CMA_DATA`):

| Caminho | Conteúdo |
|---|---|
| `data/cma.db` | banco de dados: vídeos abertos, pastas, favoritos, tarefas |
| `data/analyses/` | resultado da busca por movimentos de cada vídeo |
| `data/exports/` | trechos salvos |
| `data/proxies/` | cópias convertidas de vídeos `.avi`, `.mkv` e `.dav` para o navegador tocar |
| `data/cache/` | cache dos modelos de IA |

Para fazer backup, pare o app (`docker compose stop`) e copie a pasta `data/`.
Os arquivos de `proxies/` e `cache/` podem ser apagados: o app recria quando precisar.

## Desinstalar

```bash
docker compose down --rmi local
```

Isso remove o container e a imagem. A pasta `data/` e as suas gravações continuam onde estavam;
apague `data/` à mão se não quiser mais as análises.

---

Algo deu errado? Veja [Solução de problemas](problemas.md).
