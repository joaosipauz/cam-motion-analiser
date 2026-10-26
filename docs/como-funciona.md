# Como funciona

[← Voltar ao início](../README.md)

## Desempenho medido

Num Intel i7-8700 com GPU integrada UHD 630 e 32 GB de RAM, sem placa de vídeo dedicada, rodando
direto no Windows:

| Tarefa | Tempo |
|---|---|
| Buscar movimentos em 12 h de vídeo 1080p H.265 (GPU integrada) | ~2 min |
| A mesma busca só na CPU | ~10 min |
| Mudar área do filtro ou sensibilidade | ~50 ms |
| Melhorar uma área, modo Fiel | ~0,2 s |
| Melhorar uma área, IA forte | ~1,5 s (a primeira vez de cada tamanho leva 3 a 5 s a mais) |
| Salvar 10 s de vídeo, modo rápido | ~0,6 s |

Detalhes e metodologia em [bench/RESULTADOS.md](../bench/RESULTADOS.md).

## Busca por movimento

O app não decodifica todos os quadros. Ele lê só os keyframes (em câmeras de segurança, normalmente
um a cada 1 ou 2 segundos), ou 1 quadro por segundo quando a câmera tem keyframes muito espaçados.
Cada amostra é reduzida a 320 px em escala de cinza e comparada com um fundo que se adapta aos poucos.

Para cada amostra, o app guarda uma grade de 32 × 18 blocos com quanto cada bloco se mexeu
(`data/analyses/<id>.npz`). Por isso o filtro de área e a sensibilidade são recalculados na hora,
somando só os blocos da área escolhida, sem decodificar o vídeo de novo.

## Melhoria de imagem

- **Fiel:** pega ~15 quadros em volta do instante escolhido, alinha cada um ao central por fluxo óptico,
  amplia e combina pela mediana. Pixels que não alinham (alguém se mexendo) são descartados, o que evita
  "fantasmas". Não acrescenta nada que a câmera não gravou.
- **IA:** Real-ESRGAN x4plus, Real-ESRGAN compacto (licença BSD-3) e SwinIR (Apache-2.0), convertidos
  para OpenVINO. Rodam na GPU integrada Intel ou na CPU.
- **Escolha do quadro:** o app mede a nitidez da área (variância do Laplaciano) nos quadros de ±2 s e
  sugere os 4 mais nítidos.
- Restauração facial (GFPGAN, CodeFormer) foi testada e descartada: desenha um rosto plausível que não é
  o da pessoa.

## Arquitetura

Uma aplicação Python (FastAPI) serve a API e a interface já compilada. Ao iniciar, ela abre um processo
separado que consome uma fila de tarefas guardada no SQLite: busca por movimentos, conversão de vídeos
para o navegador e trechos salvos. Uma fila só evita que duas tarefas pesadas disputem a GPU. Se o app
for fechado no meio, a tarefa recomeça na próxima abertura.

A interface é React + Vite. A linha do tempo é desenhada em `<canvas>` para aguentar 12 horas de vídeo
com milhares de momentos.

## Estrutura do código

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
docs/                 esta documentação
Dockerfile            imagem única: interface + modelos + runtime com FFmpeg e drivers Intel
docker-compose.yml    pastas, porta e GPU
```
