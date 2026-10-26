# Solução de problemas

[← Voltar ao início](../README.md)

Comece sempre pelos registros do app:

```bash
docker compose logs -f
```

## A página http://localhost:8971 não abre

- Confira se o container está rodando: `docker compose ps`. O estado deve ser `running (healthy)`.
- Se outro programa já usa a porta 8971, mude `CMA_PORT` no `.env` (por exemplo `8972`), rode
  `docker compose up -d` e acesse a porta nova.
- No Windows, confira se o Docker Desktop está aberto.

## A pasta de gravações aparece vazia

- Confira o caminho em `CMA_VIDEOS` no `.env`. No Windows, use barras normais (`D:/Gravacoes`).
- Depois de mudar o `.env`, recrie o container: `docker compose up -d`.
- No Docker Desktop (Windows/Mac), o disco precisa estar liberado em
  **Settings → Resources → File sharing**.
- Para ver o que o container enxerga: `docker compose exec cam-motion-analiser ls /media/gravacoes`.

## "Este vídeo não abriu"

O arquivo pode estar incompleto (cópia ou download interrompido) ou corrompido. O "Detalhe técnico" da
mensagem traz o erro do leitor de vídeo. Teste abrir o arquivo no VLC; se também falhar, exporte de
novo pelo DVR.

## O vídeo não toca, mas a busca por movimentos funciona

- Use Chrome ou Edge. O Firefox não toca vídeos H.265 (HEVC), comuns em câmeras de segurança.
- Vídeos `.avi`, `.mkv` e `.dav` passam por uma conversão antes de tocar; aguarde o
  "Preparando o vídeo para tocar…" chegar a 100%.

## A busca por movimentos está lenta

- No Windows e no Mac, o Docker roda só na CPU. Para usar a GPU integrada no Windows,
  rode [sem Docker](sem-docker.md).
- No Linux, confira se `devices: /dev/dri` está ativo no `docker-compose.yml`
  ([Usar a GPU integrada Intel](docker.md#usar-a-gpu-integrada-intel-linux)).
- Vídeos lidos de um disco do Windows pelo Docker Desktop passam por uma camada de compartilhamento
  mais lenta. Copiar as gravações para dentro do WSL (`\\wsl$`) acelera a leitura.

## Muitos momentos com movimento (ou a câmera "sempre se mexe")

Árvores, trânsito, chuva e o relógio que a câmera imprime na imagem contam como movimento.
Diminua a **Sensibilidade** ou desenhe uma área e use **Só ver movimento aqui**.

## "A busca por movimentos falhou"

Clique em **Tentar de novo**. Se repetir, o "Detalhe técnico" e os registros
(`docker compose logs`) mostram o motivo; geralmente é um arquivo corrompido no meio da gravação.

## "Este modo de IA não está instalado"

Os modelos são baixados durante a construção da imagem. Se a internet caiu nesse passo, reconstrua:

```bash
docker compose build --no-cache
docker compose up -d
```

## A primeira melhoria com IA demora

Na primeira vez que um modelo é usado com um tamanho de área, ele é preparado para o seu hardware
(3 a 5 segundos a mais). O resultado fica em cache em `data/cache/` e as próximas são rápidas.

## A melhoria não deixa a placa ou o rosto legível

Nenhum método recupera detalhe que a câmera não gravou. Um rosto com menos de ~40 pixels de largura
no vídeo não chega a ser identificável. O que mais ajuda:

- usar o arquivo original exportado do DVR, não uma cópia do WhatsApp ou uma filmagem da tela;
- escolher na janela a imagem mais nítida entre as sugeridas;
- para objetos parados (carro estacionado), usar o modo **Fiel**.

## Salvar trecho dá erro

O "Detalhe técnico" traz a mensagem do FFmpeg. Áreas muito grandes não podem ser salvas com
**Melhorar com IA**; desenhe uma seleção menor.
