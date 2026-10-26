# Cam Motion Analiser

Aplicativo para revisar gravações longas de câmeras de segurança (12 horas ou mais) sem assistir tudo.
Ele encontra sozinho os momentos com movimento, mostra tudo numa linha do tempo e ajuda a examinar
e salvar o que importa.

**Tudo roda no seu computador.** Nenhum vídeo é enviado para a internet, e os arquivos originais
nunca são alterados: o app só lê.

## O que ele faz

- **Encontra o movimento.** Ao abrir um vídeo, o app procura os trechos com movimento. Num PC comum
  com GPU integrada Intel, 12 horas de vídeo 1080p levam cerca de 2 minutos.
- **Linha do tempo com horário real.** Mostra onde houve movimento ao longo do dia, com o horário da cena
  (lido do nome do arquivo ou dos metadados, e corrigível à mão).
- **Momentos com movimento.** Lista de cartões com miniatura, horário, duração e intensidade de cada trecho.
  Dá para pular entre eles (N / P) ou ligar **Emendar momentos**, que pula as partes paradas.
- **Filtro por área.** Desenhe um retângulo (por exemplo, a porta) e veja só o movimento dentro dele.
  O recálculo é instantâneo, sem analisar o vídeo de novo.
- **Sensibilidade ajustável** de 1 a 10.
- **Melhorar imagem** de uma área (placas, rostos), ampliando 4 vezes:
  - **Fiel**: combina ~15 quadros vizinhos. Não inventa nada, é o modo confiável.
  - **IA forte, SwinIR, IA rápida**: modelos de super-resolução. Ficam mais nítidos, mas **podem inventar
    detalhes que não existem** (letras de placa, traços de rosto). A interface avisa isso e marca a imagem.
  - O app sugere os quadros mais nítidos em ±2 s e salva o PNG com metadados (horário, área, modo usado).
- **Salvar trecho** com prévia: rápido (sem perder qualidade), corte exato, ou só a área selecionada
  ampliada com IA.
- **Favoritos**: guarde trechos, dê nome e volte a eles depois.
- Zoom digital no vídeo, quadro a quadro, velocidade de 1x a 16x e atalhos de teclado para tudo
  (tecla `?` mostra a lista).

> **Importante:** imagens melhoradas por IA não servem como prova. Para um caso real, guarde e entregue
> o arquivo original exportado do DVR.

## Requisitos

| | Mínimo | Observação |
|---|---|---|
| Sistema | Windows 10/11 ou Linux | macOS deve funcionar, mas não foi testado |
| Python | 3.12 | |
| Node.js | 18 ou mais novo (testado com 22) | só para compilar a interface |
| FFmpeg | qualquer versão recente | usado para salvar trechos e converter formatos |
| Navegador | Chrome ou Edge | Firefox não toca vídeos H.265 (HEVC) |
| Hardware | qualquer CPU x86-64 | GPU integrada Intel acelera bastante; placa NVIDIA não é necessária |

## Rodando no Windows

Os comandos abaixo são para o **PowerShell**, a partir da pasta onde você quer o projeto.

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

### 4. Baixar os modelos de IA (opcional)

Sem este passo o app funciona normalmente; só os modos de IA da melhoria de imagem ficam indisponíveis
(Fiel e Original continuam funcionando). Os modelos são baixados uma vez e convertidos para o formato
do OpenVINO. O PyTorch é usado só nessa conversão.

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

### 5. Iniciar

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8971
```

Abra **http://localhost:8971** no Chrome ou no Edge. Para parar, pressione `Ctrl+C` no PowerShell.

Se aparecer erro de FFmpeg ao salvar trechos, informe o caminho dele antes de iniciar:

```powershell
$env:CMA_FFMPEG = "C:\caminho\para\ffmpeg.exe"
```

## Rodando no Linux

```bash
sudo apt install python3.12 python3.12-venv ffmpeg nodejs npm git
git clone https://github.com/joaosipauz/cam-motion-analiser.git
cd cam-motion-analiser
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
(cd frontend && npm ci && npm run build)
```

Os modelos de IA seguem o mesmo passo 4 do Windows, trocando `.\.venv\Scripts\python` por
`.venv/bin/python`, `curl.exe` por `curl` e `\` por `/` nos caminhos. Para iniciar:

```bash
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8971
```

Para usar a GPU integrada Intel no Linux, instale os drivers de VAAPI e OpenCL
(no Debian/Ubuntu: `intel-media-va-driver-non-free` e `intel-opencl-icd`).

## Rodando com Docker

Uma imagem única com API, processamento e interface, no estilo do Frigate. Ela baixa e converte os
modelos de IA sozinha durante a construção.

```bash
CMA_VIDEOS=/caminho/das/gravacoes docker compose up -d --build
```

Abra **http://localhost:8971**. A pasta de gravações aparece dentro do container como `/media`
(somente leitura). Em Linux com GPU integrada Intel, descomente o trecho `devices: /dev/dri` no
`docker-compose.yml` para acelerar. O Docker Desktop no Windows e no Mac não repassa a GPU integrada;
lá o processamento roda só na CPU.

> A imagem Docker ainda não foi testada de ponta a ponta. A forma validada até agora é rodar
> direto no Windows, como descrito acima.

## Primeiros passos no app

1. Clique em **Abrir pasta de vídeos** (ou tecla `B`) e em **Adicionar pasta de vídeos**. Escolha a pasta
   onde ficam as gravações; dá para cadastrar várias.
2. Clique num vídeo. A busca por movimentos começa sozinha e você já pode assistir enquanto ela roda.
3. Confira o **Horário da cena** no canto do vídeo. Se estiver errado (vídeos recebidos pelo WhatsApp
   costumam ter no nome a hora do envio), clique em **Está errado?** e informe o início da gravação.
4. Use a linha do tempo, os cartões de **Momentos com movimento** e as teclas `N` / `P` para navegar.
5. Para examinar um detalhe, pause, clique em **Selecionar uma área**, desenhe o retângulo e clique em
   **Melhorar imagem da área**.
6. Para guardar um trecho, marque início e fim com `I` e `O` e clique em **Salvar trecho**.
   Os arquivos ficam em `data/exports/`.

Pressione `?` para ver todos os atalhos.

## Desempenho medido

Num Intel i7-8700 com GPU integrada UHD 630 e 32 GB de RAM, sem placa de vídeo dedicada:

| Tarefa | Tempo |
|---|---|
| Buscar movimentos em 12 h de vídeo 1080p H.265 | ~2 min |
| Mudar área do filtro ou sensibilidade | ~50 ms |
| Melhorar uma área, modo Fiel | ~0,2 s |
| Melhorar uma área, IA forte | ~1,5 s (a primeira vez de cada tamanho leva 3 a 5 s a mais) |
| Salvar 10 s de vídeo, modo rápido | ~0,6 s |

Detalhes em [bench/RESULTADOS.md](bench/RESULTADOS.md).

## Configuração

Tudo é opcional e definido por variáveis de ambiente antes de iniciar:

| Variável | Padrão | Para que serve |
|---|---|---|
| `CMA_MEDIA_DIR` | `/media` | Pasta cadastrada automaticamente na primeira execução, se existir |
| `CMA_DATA_DIR` | `data/` | Banco de dados, análises, trechos salvos e caches |
| `CMA_MODEL_DIR` | `models/` | Modelos de IA convertidos |
| `CMA_HWACCEL` | `auto` | Decodificação por hardware: `auto`, `dxva2`, `d3d11va`, `vaapi` ou `none` |
| `CMA_OV_DEVICE` | `AUTO` | Onde rodar a IA: `AUTO`, `GPU` ou `CPU` |
| `CMA_FFMPEG` | `ffmpeg` | Caminho do executável do FFmpeg |
| `CMA_WORKER` | `1` | `0` desliga o processamento em segundo plano |

## Como funciona por dentro

- **Busca por movimento:** decodifica só os keyframes (ou 1 quadro por segundo, se a câmera tiver
  keyframes muito espaçados) em 320 px e escala de cinza, e compara com um fundo que se adapta aos poucos.
  Para cada amostra guarda uma grade de 32×18 blocos com quanto cada bloco se mexeu. Por isso o filtro de
  área e a sensibilidade são recalculados na hora, sem decodificar o vídeo de novo.
- **Melhoria Fiel:** alinha os quadros vizinhos por fluxo óptico e combina pela mediana; pixels que não
  alinham são descartados, o que evita "fantasmas" de pessoas em movimento.
- **Modelos de IA:** Real-ESRGAN (licença BSD-3) e SwinIR (Apache-2.0), convertidos para OpenVINO.
  Restauração facial (GFPGAN, CodeFormer) foi testada e descartada: ela desenha um rosto plausível que não
  é o da pessoa.
- **Processamento em segundo plano:** um processo separado consome uma fila de tarefas guardada no SQLite.
  Se o app for fechado no meio, a tarefa recomeça na próxima abertura.

### Estrutura do código

```
backend/app/
  main.py             API, interface compilada e início do processamento em segundo plano
  config.py           variáveis CMA_*
  db.py               SQLite: vídeos, tarefas, pastas, favoritos
  api/                rotas HTTP (pastas, vídeos, melhoria, trechos, favoritos)
  pipeline/           decodificação, movimento, melhoria, corte de trechos, horário
  worker/runner.py    fila de tarefas
frontend/src/         interface React + Vite
bench/                benchmarks e conversão dos modelos
docs/                 descrição das funcionalidades da interface
```

### Desenvolvendo a interface

Com o backend rodando na porta 8971, a interface pode rodar com recarga automática na porta 5173:

```bash
cd frontend
npm run dev
```

## Limitações conhecidas

- O resultado depende da gravação. Vídeos recomprimidos (WhatsApp, gravação de tela com o celular)
  perdem muito detalhe; use o arquivo original exportado do DVR sempre que possível.
- Câmeras com movimento constante na imagem (árvores, trânsito, o relógio impresso pela câmera) geram
  muitos momentos. Use o filtro de área e a sensibilidade.
- Vídeos em `.avi`, `.mkv` ou `.dav` são convertidos para um formato que o navegador toca antes de
  aparecerem no player; o original não é alterado.

## Licença

Ainda não definida. Os modelos de IA baixados têm licenças próprias (BSD-3 e Apache-2.0),
que permitem uso comercial.
