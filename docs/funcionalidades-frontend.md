# Cam Motion Analiser: funcionalidades da interface

Descrição de tudo o que a interface faz hoje, para servir de base a um novo protótipo. Este documento explica o comportamento de cada comando e o que ele exibe. **Posição, ordem e agrupamento dos elementos ficam a critério do design.**

Contexto: MVP focado só em movimento. Aplicação local, usada no navegador. Versão de 26/10/2026.

---

## 1. Conceitos

O usuário abre uma gravação longa de câmera de segurança (até 12 horas ou mais), o sistema encontra os momentos com movimento e permite navegar por eles, ampliar detalhes e exportar trechos. Nada sai do computador do usuário.

| Termo | Significado |
|---|---|
| Pasta de vídeos | Pasta do computador configurada na instalação. O app só enxerga o que está dentro dela e nunca altera os arquivos originais. |
| Análise de movimento | Varredura automática feita uma vez por vídeo. Leva cerca de 2 a 10 minutos para 12 horas, dependendo do hardware. |
| Evento | Intervalo contínuo de tempo com movimento acima da sensibilidade escolhida. Tem início, fim e intensidade máxima. |
| Intensidade | Porcentagem da área observada que mudou naquele instante. 6% significa que 6% dos pixels se mexeram. |
| Horário real | Hora do relógio em que a cena aconteceu (ex.: 14:32:05), calculada a partir da hora de início da gravação. Sem ela, o app mostra o tempo decorrido (ex.: 01:23:45). |
| Seleção | Retângulo desenhado pelo usuário sobre o vídeo. Serve de base para filtrar movimento, melhorar o quadro e exportar com melhoria. |
| Área de movimento | Uma seleção que foi transformada em filtro: a timeline e os eventos passam a considerar só o que acontece dentro dela. |
| Tarefa em segundo plano | Análise, preparo para reprodução e exportações rodam numa fila. A interface acompanha o progresso (0 a 100%) e pode ser usada enquanto isso. |

---

## 2. Biblioteca de arquivos

Navegador da pasta de vídeos. É o ponto de entrada para abrir uma gravação.

### Navegar por pastas
- Mostra o caminho atual dentro da pasta de vídeos (a raiz aparece como `/`).
- Lista as subpastas, que abrem com um clique, e os arquivos de vídeo, em ordem alfabética. Arquivos que não são vídeo e itens ocultos (começando com ponto) não aparecem.
- Fora da raiz, há um item para voltar à pasta de cima.
- Formatos reconhecidos: `.mp4`, `.mkv`, `.avi`, `.mov`, `.ts`, `.m4v`, `.dav`, `.h264`, `.h265`.
- Pasta sem vídeos nem subpastas mostra o aviso "Pasta vazia".

### Abrir um vídeo
- Cada arquivo mostra o nome e o tamanho (MB ou GB). Arquivos que já foram analisados têm uma marca de "já analisado".
- Clicar num arquivo cadastra o vídeo, lê suas informações técnicas, coloca a análise de movimento na fila e abre o vídeo na área principal. Se o vídeo já foi cadastrado, ele só é aberto; a análise anterior é reaproveitada.
- O vídeo é identificado pelo conteúdo, não pelo nome. Renomear ou mover o arquivo não perde a análise.
- Durante a abertura (normalmente menos de 1 segundo), o arquivo mostra "abrindo…" e os outros ficam bloqueados para clique.
- Se o arquivo estiver corrompido ou num formato ilegível, aparece uma mensagem de erro com o motivo.

---

## 3. Vídeos analisados

### Lista de vídeos cadastrados
- Mostra todos os vídeos já abertos, do mais recente para o mais antigo.
- Cada item exibe nome do arquivo, duração, resolução (ex.: 1920x1080) e o status da análise: *na fila*, *analisando*, *pronto* ou *erro*.
- O vídeo aberto no momento fica destacado. Clicar em outro troca o vídeo da área principal.
- Quando não há nenhum, aparece "Nenhum ainda".

### Remover análise
- Apaga do app o cadastro do vídeo, a análise, a versão preparada para o navegador e o histórico de tarefas.
- **O arquivo original nunca é apagado.** A confirmação deixa isso explícito: "Remover a análise de <nome>? O arquivo original não é apagado."
- Se o vídeo removido estava aberto, a área principal volta ao estado vazio.
- Para analisar de novo, basta abrir o arquivo pela biblioteca.

> Hoje a confirmação usa a janela nativa do navegador; o protótipo pode trazer uma confirmação própria.

### Estado vazio da área principal
Sem vídeo aberto, a área principal orienta: "Escolha um vídeo na pasta" e avisa que a análise começa automaticamente.

---

## 4. Informações do vídeo aberto

### Dados técnicos
Nome do arquivo (o caminho completo aparece ao passar o mouse), resolução, codec (ex.: h264, hevc), quadros por segundo e duração total.

### Horário de início da gravação
- Mostra data e hora de início e a **origem** dessa informação:
  - **arquivo**: extraído do nome do arquivo (ex.: `20261026_143200.mp4`)
  - **metadados**: gravado dentro do arquivo pela câmera ou pelo DVR
  - **manual**: informado pelo usuário
  - **desconhecido**: nenhuma fonte encontrada; o app mostra tempo decorrido em vez de horário
- A origem importa porque pode estar errada. Exemplo real: um vídeo recebido pelo WhatsApp tem no nome a hora do *envio*, não a da gravação. O relógio impresso na imagem pela câmera é a referência confiável.
- **Corrigir horário**: abre um campo de data e hora com segundos. Salva ao confirmar ou ao sair do campo, e a origem passa a ser "manual". Deixar o campo vazio volta para "desconhecido".
- Ao corrigir, todos os horários da tela (relógio, eixo da timeline, eventos, exportações e metadados de imagens) passam a usar o novo valor.

### Relógio da cena
Data e hora reais do quadro na posição atual de reprodução, em destaque. Atualiza continuamente enquanto o vídeo toca e a cada pulo ou busca. Sem horário de início, mostra o tempo decorrido.

---

## 5. Preparo e análise

Logo após abrir um vídeo, duas tarefas podem estar em andamento. A interface consulta o progresso a cada segundo até as duas terminarem.

### Preparo para reprodução
- Só acontece com vídeos que o navegador não toca direto (ex.: `.avi`, `.mkv`, `.dav`). O app gera uma cópia compatível, sem tocar no original.
- Enquanto isso, no lugar do player aparece "Preparando vídeo para o navegador…" com a porcentagem. Play e navegação por evento ficam desabilitados.
- Em arquivos `.mp4` comuns, esse passo não existe e o player aparece na hora.

### Análise de movimento
- Enquanto não termina, no lugar da timeline aparece "Analisando movimento… N%" com barra de progresso. O vídeo já pode ser assistido.
- Ao terminar, timeline, eventos e sensibilidade aparecem, e o status na lista de vídeos muda para "pronto".
- Em caso de falha aparece "Falha na análise:" seguido do motivo técnico.
- Se o app for fechado no meio, a análise é retomada do começo na próxima abertura.

---

## 6. Player

### Reprodução
- O vídeo é exibido na proporção original, sem cortes nem distorção, e ocupa no máximo cerca de 60% da altura da tela.
- **Play / Pausa**: alterna a reprodução. O rótulo indica a ação disponível ("Play" quando pausado, "Pausa" quando tocando). Clicar em qualquer ponto do vídeo faz o mesmo, exceto no modo de seleção.
- Não há controles nativos do navegador (barra de progresso, volume, tela cheia). A navegação no tempo é feita pela timeline, pelos eventos e pelo teclado.

### Zoom digital no vídeo
- A roda do mouse sobre o vídeo amplia ou reduz de 1x até 10x, mantendo fixo o ponto sob o cursor (como num mapa).
- Com zoom, arrastar o vídeo move a parte visível. O movimento é limitado às bordas do quadro, sem espaço vazio.
- Duplo clique volta para 1x.
- Com zoom ativo, um indicador mostra o nível (ex.: "2.4x") e lembra que o duplo clique volta ao normal.
- Seleções e áreas desenhadas acompanham o zoom e continuam presas aos mesmos pontos da imagem.
- Zoom e arraste funcionam durante a reprodução.

### Navegação por evento
- **Evento anterior** e **Próximo evento**: pulam para o início do evento antes ou depois da posição atual. Eventos muito próximos da posição atual (menos de 0,5 s) são ignorados, para o comando não "travar" no mesmo evento.
- Ficam desabilitados até a análise terminar. Se não houver evento naquela direção, nada acontece.
- A navegação respeita o filtro de área e a sensibilidade atuais.

### Navegação fina
Pelo teclado: avançar ou voltar 5 s (ou 60 s com Shift) e avançar ou voltar exatamente um quadro, o que pausa o vídeo. O quadro a quadro é essencial para achar o melhor momento de uma placa ou rosto antes de melhorar. Ver a seção 14 (Atalhos).

---

## 7. Seleção de área

A seleção é o retângulo que conecta três funções: filtrar movimento, melhorar quadro e exportar com melhoria.

### Modo de seleção
- **Selecionar área** liga e desliga o modo de desenho, também pela tecla `S`. Ligado, o comando aparece ativo e o cursor sobre o vídeo vira mira.
- No modo de seleção, clicar e arrastar desenha o retângulo, com prévia em tempo real. O clique deixa de tocar ou pausar o vídeo.
- Ao soltar o mouse, a seleção é criada e o modo desliga sozinho.
- Retângulos muito pequenos (menos de 1% da largura ou da altura) são descartados.
- Desenhar de novo substitui a seleção anterior. Só existe uma seleção por vez.
- A seleção é guardada em coordenadas relativas ao quadro. Ela continua correta com zoom, em outra resolução e ao exportar.

### Ações disponíveis quando há seleção
- **Filtrar movimento aqui**: transforma a seleção em área de movimento (ver seção 8).
- **Melhorar quadro**: pausa o vídeo e abre o diálogo de melhoria para a seleção no quadro atual. É a ação principal da seleção.
- **Limpar seleção**: apaga a seleção (também por `Esc`, que além disso desliga o modo de seleção).
- A exportação de trecho com melhoria também usa a seleção atual.

### Distinção visual
A **seleção** e a **área de movimento** podem existir ao mesmo tempo e estar em lugares diferentes. Hoje se distinguem por cor (âmbar × verde), estilo de borda (tracejada × contínua) e rótulo ("seleção" × "área de movimento"). O protótipo precisa manter as duas claramente diferentes.

---

## 8. Filtro de movimento por área

### Filtrar movimento aqui
- Faz timeline, eventos e navegação por evento considerarem só o movimento dentro da área. Uso típico: ignorar a rua e olhar só a porta, ou ignorar uma árvore balançando.
- O recálculo leva cerca de 50 ms, sem nova varredura do vídeo. Dá para testar áreas diferentes à vontade.
- A área fica desenhada sobre o vídeo, separada da seleção. Depois de aplicar o filtro, a seleção pode ser limpa ou redesenhada sem afetar a área.
- Precisão: a análise divide o quadro numa grade de 32 × 18 blocos. Áreas muito finas são aproximadas pelos blocos que tocam.

### Remover filtro de área
Só existe quando há filtro ativo. Volta a considerar o quadro inteiro.

---

## 9. Sensibilidade

### Controle de 1 a 10
- Define o mínimo de movimento para algo contar como evento. Valor inicial: 7.
- Quanto maior, mais eventos (inclusive pequenos). Quanto menor, só movimentos grandes. Mínimo de pixels em movimento por nível:

| Nível | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Área em movimento | 12% | 8% | 5% | 3,5% | 2,5% | 1,8% | 1,2% | 0,8% | 0,5% | 0,3% |

- O número atual aparece junto ao controle. A mudança é aplicada na hora (com atraso de ~0,1 s para não recalcular a cada pixel arrastado).
- Afeta a lista de eventos, as faixas de evento e as cores das barras na timeline, e a navegação por evento.
- A sensibilidade vale sobre a área filtrada, quando houver. Numa área pequena, 1,2% é proporcionalmente bem menos pixels.

---

## 10. Timeline

Visão do vídeo inteiro (ou de um trecho ampliado) mostrando onde houve movimento. Precisa funcionar bem com 12 horas e milhares de eventos.

### O que ela exibe
- **Barras de intensidade**: uma barra por faixa de tempo (cerca de 2.000 no vídeo inteiro), com altura proporcional ao movimento. A escala é relativa ao maior pico visível, para picos não saturarem. Barras acima da sensibilidade têm cor "quente"; abaixo, cor neutra.
- **Faixas de evento**: fundo destacado cobrindo o intervalo de cada evento.
- **Trecho de exportação**: sombreado entre o início e o fim marcados. Se só uma ponta foi marcada, o trecho vai até o começo ou o fim do vídeo.
- **Cursor**: linha da posição atual de reprodução.
- **Eixo de tempo**: marcas com horário real (ex.: 10:45:00), alinhadas a horas cheias do relógio. O intervalo entre marcas se adapta ao zoom (de 1 s a 4 h), com cerca de uma marca a cada 90 px.

### Interações
- **Clique**: pula o vídeo para aquele instante.
- **Roda do mouse**: zoom no tempo, ancorado no ponto sob o cursor. Vai do vídeo inteiro até uma janela de 10 segundos.
- **Arrastar**: com zoom, desloca a janela de tempo. Um arraste curto (até 3 px) conta como clique.
- **Ver tudo**: só aparece com zoom ativo e volta para o vídeo inteiro.
- **Passar o mouse**: mostra o horário daquele ponto e, após uma pausa curta (~0,1 s), uma miniatura do quadro. É a forma de "espiar" o vídeo sem pular.
- **Seguir o cursor**: quando a reprodução sai da janela visível, a janela acompanha automaticamente.
- Uma linha de ajuda resume as interações: roda = zoom, arrastar = mover, clique = ir ao momento.

---

## 11. Lista de eventos

- O total de eventos aparece junto ao título e muda com sensibilidade e área.
- Cada evento mostra: miniatura do quadro ~1,5 s após o início, horário real de início, duração e intensidade máxima em porcentagem.
- Clicar num evento pula para o início dele.
- O evento em reprodução no momento fica destacado.
- Ordem cronológica. Mostra 100 por vez, com "mostrar mais (N)" para carregar os próximos 100. As miniaturas só carregam quando entram na tela.
- Sem eventos: "Nenhum movimento com essa sensibilidade".
- Eventos separados por menos de ~3 s de calmaria são unidos num só. Cada evento ganha uma pequena margem antes e depois.

---

## 12. Melhorar quadro

Diálogo para ampliar 4 vezes a seleção num quadro específico, tentando tornar legíveis placas, rostos e detalhes. Abre pelo comando "Melhorar quadro", que só existe com seleção, e usa o instante em que o vídeo foi pausado.

### Modos de melhoria
O usuário alterna entre os modos. Cada modo mostra uma explicação curta; os modos de IA mostram um aviso de que podem inventar detalhes. Modo inicial: IA forte.

| Modo | O que faz | Tempo típico | Inventa detalhe? |
|---|---|---|---|
| Fiel | Alinha ~15 quadros vizinhos e combina. Reduz ruído e compressão usando só informação real. Melhor para objetos parados (placa de carro estacionado). | ~0,2 s | Não |
| IA forte | Modelo Real-ESRGAN x4plus. O mais nítido e equilibrado. | ~1,5 s | Pode |
| SwinIR | Modelo alternativo. Resultado mais limpo, mais lento. | ~5 s | Pode |
| IA rápida | Modelo compacto. Pouco ganho, quase instantâneo. | ~0,2 s | Pode |
| Original | Ampliação simples, sem processamento. Serve de referência para comparar. | instantâneo | Não |

> A primeira melhoria de um tamanho de seleção numa sessão pode levar 3 a 5 s a mais (preparo do modelo). A interface precisa de um estado de "processando" que comporte essa espera.

### Seletor de quadros
- Ao abrir, o app analisa os quadros de 2 s antes a 2 s depois do pausado e oferece o **quadro pausado + os 4 mais nítidos** da área (leva ~0,2 s). Enquanto procura: "procurando os mais nítidos…".
- Cada opção mostra: miniatura recortada só na seleção, a distância em segundos do pausado (ex.: "+1,35 s", "−0,48 s") ou o rótulo "pausado", e uma barra de nitidez relativa (100% = o mais nítido da janela).
- Opções em ordem cronológica; o quadro em uso fica destacado. Trocar de quadro refaz a melhoria no modo atual.
- A melhoria só começa depois que a lista de quadros chega, para não processar duas vezes.
- O título do diálogo mostra data e hora real do quadro escolhido.

### Visualizador do resultado
- Roda do mouse: zoom de 0,5x a 16x, ancorado no cursor. Arrastar move a imagem. Duplo clique volta a ajustar à área.
- Cada combinação de modo + quadro é guardada enquanto o diálogo está aberto. Voltar a uma combinação já vista é instantâneo, o que permite comparar modos rapidamente.
- Estados: "Processando…", resultado, ou mensagem de erro.

### Baixar PNG
- Salva a imagem ampliada do modo e quadro em exibição. Nome do arquivo: `melhoria_<data>_<hora>_<modo>.png`.
- O PNG leva metadados embutidos: nome do vídeo, segundo exato, horário real, área, modo, fator 4x e se houve detalhe gerado por IA. Serve de registro do que foi feito com a imagem.

### Limites
- Seleção grande demais (acima de ~640 × 640 pixels do vídeo original): "Area muito grande para ampliar 4x; selecione uma regiao menor."
- Seleção pequena demais (menos de 8 pixels): "Area muito pequena."
- Modelo de IA ausente na instalação: "Modelo de IA nao instalado".
- Fechar: botão de fechar, `Esc` ou clique fora do diálogo. Com o diálogo aberto, os atalhos do player ficam desativados.

> **Ponto crítico para o design:** o resultado de IA *parece* nítido, mas pode mostrar letras de placa ou traços de rosto que não existem. O aviso precisa ser impossível de ignorar, e o modo "Fiel" precisa ser apresentado como a opção confiável para fins de prova.

---

## 13. Exportar trecho

### Marcar o trecho
- **Início** e **Fim** marcam a posição atual de reprodução como ponta do trecho (também `I` e `O`). Cada ponta mostra seu horário real ou "--:--:--" se não marcada.
- Marcar de novo substitui o valor. **Limpar trecho** apaga as duas pontas e só aparece com alguma ponta marcada.
- O trecho marcado aparece sombreado na timeline.
- A exportação só fica disponível com as duas pontas marcadas e o fim depois do início.

### Tipo de exportação
- **Rápido (sem recodificar)**: copia o trecho sem perda e quase instantaneamente (~0,6 s para 10 s). O início pode recuar alguns segundos, até o ponto de corte possível mais próximo; o app avisa isso.
- **Corte exato**: reprocessa o vídeo para começar e terminar no quadro exato. Um pouco mais lento (~1 s para 10 s).
- **Com melhoria IA da seleção**: gera um vídeo só da área selecionada, ampliado 4x quadro a quadro. Exige seleção; sem ela, aparece "Desenhe uma seleção no vídeo para melhorar".

### Modelo para exportação com melhoria
- Só aparece no tipo "com melhoria". Opções: IA rápida (~0,1 s por quadro, o padrão), IA forte (~1–2 s por quadro) e SwinIR (vários segundos por quadro).
- Referência: 10 s de vídeo a 30 fps são 300 quadros. Com IA rápida leva ~20 s; com IA forte, 5 a 10 minutos. O design deve deixar esse custo claro antes de começar.

### Acompanhar e baixar
- **Exportar trecho** coloca a exportação na fila. Várias exportações podem ser pedidas seguidas e aparecem numa lista, da mais recente para a mais antiga.
- Cada item mostra "Exportando… N%" com barra de progresso, depois vira um link de download com o nome do arquivo ou "Falhou:" com o motivo.
- Os arquivos ficam guardados na pasta de dados do app.
- A lista mostra só as exportações pedidas desde que o vídeo foi aberto.

---

## 14. Atalhos de teclado

Valem na tela do vídeo, exceto quando o foco está num campo de texto ou com o diálogo de melhoria aberto. Hoje os atalhos ficam listados numa linha de ajuda sempre visível.

| Tecla | Ação |
|---|---|
| `Espaço` | Play / pausa |
| `→` / `←` | Avança / volta 5 s |
| `Shift` + `→` / `←` | Avança / volta 60 s |
| `.` / `,` | Próximo / quadro anterior (pausa o vídeo) |
| `N` / `P` | Próximo / evento anterior |
| `I` / `O` | Marca início / fim do trecho de exportação |
| `S` | Liga / desliga o modo de seleção |
| `Esc` | Limpa a seleção e sai do modo de seleção; no diálogo de melhoria, fecha |
| Roda do mouse | Zoom no vídeo, na timeline ou na imagem melhorada (onde estiver o cursor) |
| Duplo clique | Volta o zoom ao normal (vídeo e imagem melhorada) |

---

## 15. Estados e mensagens

Situações que o protótipo precisa prever, além dos estados normais.

| Onde | Situação | Mensagem atual |
|---|---|---|
| Biblioteca | Carregando a pasta | Carregando… |
| Biblioteca | Pasta sem vídeos | Pasta vazia. |
| Biblioteca | Arquivo ilegível | Não foi possível ler o vídeo: <motivo> |
| Biblioteca | Pasta de vídeos inexistente | Pasta não encontrada |
| Player | Gerando versão compatível | Preparando vídeo para o navegador… N% |
| Timeline | Análise em andamento | Analisando movimento… N% |
| Timeline | Análise falhou | Falha na análise: <motivo> |
| Eventos | Nenhum evento | Nenhum movimento com essa sensibilidade. |
| Melhoria | Processando | Processando… |
| Melhoria | Área grande / pequena demais | Ver seção 12, Limites |
| Exportar | Falta seleção | Desenhe uma seleção no vídeo para melhorar. |
| Exportar | Fim antes do início / além do vídeo | Fim deve ser depois do inicio / Fim além da duração do vídeo |
| Exportar | Falha na exportação | Falhou: <motivo> |

> Várias mensagens vindas do servidor estão sem acento ("nao", "regiao"). O protótipo pode propor o texto final de todas elas.
