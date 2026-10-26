/** Atalhos de teclado (DESIGN.md seção 10). Fonte única para a legenda e a janela de atalhos. */

export interface Shortcut {
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  title: string;
  color: string;
  note?: string;
  items: Shortcut[];
}

const k = (keys: string[], label: string): Shortcut => ({ keys, label });

export const LEGEND: Shortcut[] = [
  k(["Espaço"], "tocar / pausar"),
  k([",", "."], "quadro a quadro"),
  k(["←", "→"], "5 segundos"),
  k(["Shift", "← →"], "1 minuto"),
  k(["P", "N"], "movimento anterior / próximo"),
  k(["I", "O"], "início / fim do trecho"),
  k(["S"], "selecionar área"),
  k(["−", "+"], "velocidade"),
  k(["M"], "favoritar"),
];

export const GROUPS: ShortcutGroup[] = [
  {
    title: "Tocar e pausar",
    color: "var(--text)",
    items: [
      k(["Espaço"], "Tocar ou pausar o vídeo"),
      k(["Clique"], "Clicar no vídeo também toca ou pausa"),
      k(["−", "+"], "Velocidade: 1x, 2x, 4x, 8x, 16x"),
    ],
  },
  {
    title: "Quadro a quadro",
    color: "var(--selection-text)",
    note: "Pausa o vídeo e anda uma imagem por vez. Use para achar o instante mais nítido de uma placa ou rosto antes de melhorar a imagem.",
    items: [k(["."], "Próximo quadro"), k([","], "Quadro anterior")],
  },
  {
    title: "Andar no tempo",
    color: "var(--text)",
    items: [
      k(["→"], "Avançar 5 segundos"),
      k(["←"], "Voltar 5 segundos"),
      k(["Shift", "→"], "Avançar 1 minuto"),
      k(["Shift", "←"], "Voltar 1 minuto"),
      k(["Home", "End"], "Começo / fim do vídeo"),
    ],
  },
  {
    title: "Pular entre movimentos",
    color: "var(--motion-text)",
    items: [
      k(["N"], "Ir para o próximo movimento"),
      k(["P"], "Voltar para o movimento anterior"),
      k(["A"], "Emendar momentos: ao fim de um, toca o próximo"),
      k(["[", "]"], "Menos / mais sensibilidade"),
    ],
  },
  {
    title: "Trecho para salvar",
    color: "var(--text)",
    items: [
      k(["I"], "Marcar o ponto atual como início"),
      k(["O"], "Marcar o ponto atual como fim"),
      k(["X"], "Abrir “Salvar trecho”"),
      k(["M"], "Favoritar o trecho marcado, o momento ou o ponto atual"),
    ],
  },
  {
    title: "Área, zoom e imagem",
    color: "var(--filter-text)",
    items: [
      k(["S"], "Ligar ou desligar a seleção de área"),
      k(["F"], "Só ver movimento na seleção"),
      k(["E"], "Melhorar imagem da seleção"),
      k(["Esc"], "Apagar a seleção ou fechar uma janela"),
      k(["Roda"], "Aproximar ou afastar onde está o mouse"),
      k(["Arrastar"], "Mover a imagem ampliada ou a linha do tempo"),
      k(["2 cliques"], "Voltar o zoom ao normal"),
    ],
  },
  {
    title: "Janelas",
    color: "var(--text)",
    items: [k(["B"], "Abrir seus vídeos"), k(["?"], "Mostrar esta lista")],
  },
];

// 16x ajuda a varrer gravações longas; o navegador não passa disso
export const SPEEDS = [1, 2, 4, 8, 16];

/** Atalhos não valem com foco em campo de texto nem com janela modal aberta. */
export function shortcutsBlocked(e: KeyboardEvent) {
  const t = e.target;
  if (t instanceof Element && t.closest("input, textarea, select, [contenteditable='true']")) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (e.repeat && (e.key === "?" || e.key === "b" || e.key === "x")) return true;
  return document.querySelector('[aria-modal="true"]') !== null;
}
