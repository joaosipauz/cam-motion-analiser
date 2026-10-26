import { ReactNode, useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Prende o foco dentro de `ref`, foca o primeiro controle e devolve o foco ao fechar. */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, onEscape?: () => void) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escRef.current) {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const a = items[0];
      const b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [ref]);
}

interface Props {
  label: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Janela centralizada: fundo escurecido, Esc e clique fora fecham. */
export function Modal({ label, className = "", onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={`dialog ${className}`} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
