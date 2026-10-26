# Usando o app

[← Voltar ao início](../README.md)

- [Abrir um vídeo](#abrir-um-vídeo)
- [Conferir o horário](#conferir-o-horário)
- [Navegar pelos momentos com movimento](#navegar-pelos-momentos-com-movimento)
- [Filtrar por área e ajustar a sensibilidade](#filtrar-por-área-e-ajustar-a-sensibilidade)
- [Melhorar a imagem de uma área](#melhorar-a-imagem-de-uma-área)
- [Salvar um trecho](#salvar-um-trecho)
- [Favoritos](#favoritos)
- [Atalhos de teclado](#atalhos-de-teclado)

## Abrir um vídeo

1. Clique no seletor de vídeo no topo (ou tecle `B`) para abrir **Seus vídeos**.
2. Na aba **Na pasta**, entre na pasta das gravações e clique num vídeo.
3. O app procura os momentos com movimento sozinho. Enquanto procura, aparece o progresso no topo e
   na barra do player; você já pode assistir.

Para cadastrar outra pasta, use **Adicionar pasta de vídeos** (no Docker, a pasta precisa estar montada
no container; veja [Várias pastas de câmeras](docker.md#várias-pastas-de-câmeras)).
A aba **Já abertos** lista os vídeos já analisados. Remover um vídeo dali apaga só a análise; o arquivo
original continua na pasta.

Formatos aceitos: mp4, mkv, avi, mov, ts, m4v, dav, h264 e h265. Vídeos `.avi`, `.mkv` e `.dav` são
convertidos antes de tocar no navegador; o original não é alterado.

## Conferir o horário

O canto superior esquerdo do vídeo mostra o **horário da cena**, calculado a partir do início da
gravação, que o app tira do nome do arquivo ou dos metadados.

Se estiver errado, clique em **Está errado?** e informe a data e a hora em que a gravação começou.
Compare com o relógio que a câmera imprime na imagem. Vídeos recebidos pelo WhatsApp costumam ter
no nome a hora em que foram enviados, não a da gravação.

## Navegar pelos momentos com movimento

- **Linha do tempo** (na base do vídeo): barras laranja indicam movimento. Clique para ir até o ponto,
  role a roda do mouse para aproximar e arraste para mover. Passar o mouse mostra uma miniatura.
- **Momentos com movimento** (abaixo do vídeo): um cartão por trecho, com horário, duração e quanto da
  imagem se mexeu. Clique para ir até ele.
- **Pular entre momentos:** `N` vai ao próximo e `P` volta ao anterior.
- **Emendar momentos** (tecla `A`): com o modo ligado, quando um momento termina o vídeo pula a parte
  parada e toca o próximo.
- **Velocidade:** de 1x a 16x, na barra do player ou com `−` e `+`.
- **Quadro a quadro:** `,` e `.` andam uma imagem por vez, bom para achar o instante mais nítido.

## Filtrar por área e ajustar a sensibilidade

1. Clique em **Selecionar uma área** (ou `S`) e desenhe um retângulo sobre o vídeo.
2. Clique em **Só ver movimento aqui** (ou `F`).

A linha do tempo e a lista passam a considerar só o movimento dentro do retângulo verde. O recálculo é
instantâneo. **Remover filtro** volta ao quadro inteiro.

A **Sensibilidade** (1 a 10, no topo; atalhos `[` e `]`) define o mínimo de movimento para contar: o
texto ao lado diz a porcentagem da imagem que precisa mudar. Câmeras com movimento constante (árvores,
rua) pedem sensibilidade mais baixa ou um filtro de área.

## Melhorar a imagem de uma área

1. Pause no instante desejado (use `,` e `.` para ajustar).
2. Selecione a área (placa, rosto) e clique em **Melhorar imagem da área** (ou `E`).

A janela amplia a área 4 vezes e oferece:

| Modo | O que faz | Confiável para prova? |
|---|---|---|
| **Fiel** | Junta ~15 imagens vizinhas. Usa só o que a câmera gravou. Melhor para coisas paradas. | Sim |
| **IA forte** | A mais nítida e equilibrada (~1,5 s). | Não |
| **SwinIR** | Mais limpa, mais lenta (~5 s). | Não |
| **IA rápida** | Melhora pouco, quase instantânea. | Não |
| **Original** | Sem tratamento, para comparar. | Sim |

Os modos de IA podem desenhar letras ou traços que não existem; a janela avisa e marca a imagem.

Embaixo aparecem a imagem pausada e as 4 mais nítidas em até 2 segundos antes ou depois. Escolher outra
refaz a melhoria. **Baixar PNG** salva a imagem com o horário, a área e o modo gravados no arquivo.

Áreas muito grandes (acima de ~640×640 pixels do vídeo) não podem ser ampliadas; desenhe uma seleção menor.

## Salvar um trecho

1. Marque o início com `I` e o fim com `O` (ou pelos botões na barra do player).
2. Clique em **Salvar trecho** no topo (ou `X`).

A janela mostra uma prévia que repete o trecho. Ajuste as pontas arrastando as alças brancas ou com
os botões `−` e `+` (Shift anda um quadro). Escolha como salvar:

- **Rápido:** recorta sem perder qualidade, em segundos. Pode começar um pouco antes do marcado; o app
  avisa exatamente onde.
- **Corte exato:** começa e termina onde você marcou.
- **Melhorar com IA:** gera um vídeo só da área selecionada, ampliado 4 vezes. Pode demorar; o app
  mostra o tempo estimado antes de começar.

O trecho continua sendo salvo mesmo se você fechar a janela. Quando termina, aparece o link para baixar.

## Favoritos

Guarde trechos para voltar depois:

- **Favoritar** (tecla `M`) guarda o trecho marcado com início e fim; sem marcação, guarda o momento
  que está tocando; fora de um momento, guarda o ponto atual.
- A estrela ☆ nos cartões de momentos guarda aquele momento.
- Na aba **Favoritos**, dê nome a cada um, clique para ir até ele ou use **Salvar** para abrir
  "Salvar trecho" já com o intervalo.

Os favoritos aparecem como losangos lilás na linha do tempo.

## Atalhos de teclado

Tecle `?` para ver a lista no app. Os atalhos não funcionam enquanto você digita num campo ou com
uma janela aberta.

| Tecla | Ação |
|---|---|
| `Espaço` | Tocar ou pausar (clicar no vídeo também) |
| `,` / `.` | Quadro anterior / próximo |
| `←` / `→` | Voltar / avançar 5 s (com `Shift`, 1 min) |
| `Home` / `End` | Começo / fim do vídeo |
| `−` / `+` | Velocidade (1x, 2x, 4x, 8x, 16x) |
| `P` / `N` | Momento anterior / próximo |
| `A` | Emendar momentos |
| `[` / `]` | Menos / mais sensibilidade |
| `I` / `O` | Marcar início / fim do trecho |
| `X` | Salvar trecho |
| `M` | Favoritar |
| `S` | Selecionar uma área |
| `F` | Só ver movimento na seleção |
| `E` | Melhorar imagem da seleção |
| `Esc` | Apagar a seleção ou fechar uma janela |
| `B` | Abrir seus vídeos |
| `?` | Mostrar os atalhos |
| Roda do mouse | Zoom no vídeo, na linha do tempo ou na imagem melhorada |
| Duplo clique | Voltar o zoom ao normal |
