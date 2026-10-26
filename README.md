# Cam Motion Analiser

Aplicativo para revisar gravações longas de câmeras de segurança (12 horas ou mais) sem assistir tudo.
Ele encontra sozinho os momentos com movimento, mostra tudo numa linha do tempo e ajuda a examinar
e salvar o que importa.

**Tudo roda no seu computador.** Nenhum vídeo é enviado para a internet, e os arquivos originais
nunca são alterados: o app só lê.

## O que ele faz

- **Encontra o movimento.** Ao abrir um vídeo, o app procura os trechos com movimento.
  Num PC comum com GPU integrada Intel, 12 horas de vídeo 1080p levam cerca de 2 minutos.
- **Linha do tempo com horário real**, com os momentos com movimento destacados.
- **Filtro por área.** Desenhe um retângulo (a porta, o portão) e veja só o movimento dentro dele.
- **Melhorar imagem** de placas e rostos, com um modo fiel (não inventa nada) e modos de IA.
- **Salvar trechos**, **favoritos**, zoom, quadro a quadro, velocidade até 16x e atalhos de teclado.

> Imagens melhoradas por IA não servem como prova: a IA pode desenhar detalhes que não existem.
> Para um caso real, guarde e entregue o arquivo original exportado do DVR.

## Início rápido com Docker

Você precisa do [Docker](https://docs.docker.com/get-docker/) instalado (no Windows e no Mac,
o Docker Desktop).

```bash
git clone https://github.com/joaosipauz/cam-motion-analiser.git
cd cam-motion-analiser
cp .env.example .env
```

Abra o arquivo `.env` e coloque em `CMA_VIDEOS` a pasta onde ficam as gravações. Depois:

```bash
docker compose up -d --build
```

A primeira construção leva alguns minutos (baixa dependências e os modelos de IA).
Quando terminar, abra **http://localhost:8971**, clique em **Abrir pasta de vídeos** e escolha um vídeo
dentro de `gravacoes`.

O passo a passo completo, incluindo Windows, GPU integrada Intel e várias pastas de câmeras,
está em [Instalação com Docker](docs/docker.md).

## Documentação

| Página | Para quê |
|---|---|
| [Instalação com Docker](docs/docker.md) | Instalar, atualizar, parar, fazer backup e usar a GPU integrada |
| [Usando o app](docs/uso.md) | Primeiros passos, funcionalidades e atalhos de teclado |
| [Configuração](docs/configuracao.md) | Variáveis do `.env` e do `docker-compose.yml` |
| [Solução de problemas](docs/problemas.md) | O que fazer quando algo não funciona |
| [Rodar sem Docker](docs/sem-docker.md) | Instalação direta no Windows ou Linux e desenvolvimento |
| [Como funciona](docs/como-funciona.md) | Arquitetura, desempenho medido e estrutura do código |
| [Funcionalidades da interface](docs/funcionalidades-frontend.md) | Descrição detalhada de cada tela, para design |

## Requisitos

- Docker com Compose (já vem no Docker Desktop).
- Qualquer CPU x86-64. Uma GPU integrada Intel acelera bastante; placa NVIDIA não é necessária.
- Chrome ou Edge para usar a interface (o Firefox não toca vídeos H.265).

## Estado do projeto

A forma validada de ponta a ponta até agora é rodar sem Docker no Windows. A imagem Docker segue
a mesma configuração, mas ainda não foi testada de ponta a ponta. Se encontrar um problema,
abra uma issue.

## Licença

Ainda não definida. Os modelos de IA baixados têm licenças próprias (BSD-3 e Apache-2.0),
que permitem uso comercial.
