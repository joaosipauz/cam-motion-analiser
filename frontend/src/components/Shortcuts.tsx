import { IconClose } from "../icons";
import { GROUPS, LEGEND } from "../shortcuts";
import { Modal } from "./Modal";

/** Legenda fixa abaixo do vídeo (DESIGN.md 4.8). */
export function ShortcutLegend({ onOpenAll }: { onOpenAll: () => void }) {
  return (
    <div className="legend" aria-label="Atalhos de teclado">
      {LEGEND.map((l) => (
        <span key={l.label} className="item">
          {l.keys.map((k) => (
            <kbd key={k}>{k}</kbd>
          ))}
          <span>{l.label}</span>
        </span>
      ))}
      <button className="btn sm all" onClick={onOpenAll}>
        Todos os atalhos <kbd>?</kbd>
      </button>
    </div>
  );
}

/** Janela com todos os atalhos (DESIGN.md 4.11). */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Atalhos de teclado" className="keys" onClose={onClose}>
      <div className="dialog-head">
        <div className="titles">
          <h2>Atalhos de teclado</h2>
          <span className="t3" style={{ fontSize: 12 }}>
            Não funcionam enquanto você digita num campo ou com uma janela aberta.
          </span>
        </div>
        <button className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      <div className="keys-grid">
        {GROUPS.map((g) => (
          <div key={g.title} className="keys-group">
            <h3 style={{ color: g.color }}>{g.title}</h3>
            {g.note && <span className="note">{g.note}</span>}
            {g.items.map((it) => (
              <div key={it.label} className="keys-row">
                <span className="keys">
                  {it.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
                <span>{it.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
