import { IconClose, IconEnhance, IconFilter, IconSelect } from "../icons";

interface Props {
  selecting: boolean;
  hasSelection: boolean;
  hasFilter: boolean;
  searchDone: boolean;
  onToggleSelect: () => void;
  onFilter: () => void;
  onEnhance: () => void;
  onClearSelection: () => void;
  onRemoveFilter: () => void;
}

/** Ferramentas de área (DESIGN.md 4.4). */
export function AreaTools(p: Props) {
  return (
    <div className="area-tools" role="toolbar" aria-label="Ferramentas de área">
      <button className="tool select" aria-pressed={p.selecting} onClick={p.onToggleSelect} title="Selecionar uma área (S)">
        <IconSelect />
        <span>Selecionar uma área</span>
        <kbd className="inline">S</kbd>
      </button>
      <button
        className="tool filter"
        disabled={!p.hasSelection || !p.searchDone}
        onClick={p.onFilter}
        title="Contar só o movimento dentro da seleção (F)"
      >
        <IconFilter />
        <span>Só ver movimento aqui</span>
      </button>
      <button className="tool enhance" disabled={!p.hasSelection} onClick={p.onEnhance} title="Melhorar imagem da área (E)">
        <IconEnhance />
        <span>Melhorar imagem da área</span>
      </button>
      {p.hasSelection && (
        <button className="tool" onClick={p.onClearSelection} title="Apagar seleção (Esc)">
          <IconClose size={16} />
          <span>Apagar seleção</span>
          <kbd className="inline">Esc</kbd>
        </button>
      )}
      {p.hasFilter && (
        <button className="tool filter" onClick={p.onRemoveFilter} title="Voltar a considerar o quadro inteiro">
          <IconClose size={16} />
          <span>Remover filtro</span>
        </button>
      )}
    </div>
  );
}
