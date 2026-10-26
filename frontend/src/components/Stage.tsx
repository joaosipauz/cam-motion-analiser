import { PointerEvent, ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState, WheelEvent } from "react";
import { Roi } from "../api";

export interface ZoomView {
  s: number;
  x: number;
  y: number;
}

export const NO_ZOOM: ZoomView = { s: 1, x: 0, y: 0 };

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  src: string | null;
  videoWidth: number;
  videoHeight: number;
  videoRef: RefObject<HTMLVideoElement>;
  selectMode: boolean;
  selection: Roi | null;
  filter: Roi | null;
  view: ZoomView;
  onView: (v: ZoomView) => void;
  onSelection: (roi: Roi | null) => void;
  onTogglePlay: () => void;
  /** Painéis sobre o vídeo (fora do zoom). */
  children?: ReactNode;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Palco do vídeo. O quadro fica contido (sem cortes) dentro da área 16:8; seleção,
 * filtro e zoom usam coordenadas relativas ao quadro real, não à área do palco.
 */
export function Stage(props: Props) {
  const { src, videoWidth, videoHeight, videoRef, selectMode, selection, filter, view, onView, onSelection, onTogglePlay, children } =
    props;
  const outer = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<Rect>({ left: 0, top: 0, width: 0, height: 0 });
  const [draft, setDraft] = useState<Roi | null>(null);
  const drag = useRef<{ kind: "pan" | "select"; x0: number; y0: number; vx: number; vy: number; moved: boolean } | null>(
    null,
  );
  const aspect = videoWidth / videoHeight || 16 / 9;

  // retângulo do vídeo contido no palco
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w / h > aspect) {
        const cw = h * aspect;
        setContent({ left: (w - cw) / 2, top: 0, width: cw, height: h });
      } else {
        const ch = w / aspect;
        setContent({ left: 0, top: (h - ch) / 2, width: w, height: ch });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  // novo modo de seleção descarta um rascunho pendente
  useEffect(() => {
    if (!selectMode) setDraft(null);
  }, [selectMode]);

  function limit(s: number, x: number, y: number): ZoomView {
    return {
      s,
      x: clamp(x, content.width - content.width * s, 0),
      y: clamp(y, content.height - content.height * s, 0),
    };
  }

  function onWheel(e: WheelEvent) {
    const r = (e.currentTarget as HTMLElement).parentElement!.parentElement!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const s = clamp(view.s * (e.deltaY < 0 ? 1.25 : 0.8), 1, 10);
    const cx = (px - view.x) / view.s;
    const cy = (py - view.y) / view.s;
    onView(s === 1 ? { s: 1, x: 0, y: 0 } : limit(s, px - cx * s, py - cy * s));
  }

  function norm(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
  }

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const [nx, ny] = norm(e);
    drag.current = {
      kind: selectMode ? "select" : "pan",
      x0: selectMode ? nx : e.clientX,
      y0: selectMode ? ny : e.clientY,
      vx: view.x,
      vy: view.y,
      moved: false,
    };
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "select") {
      const [nx, ny] = norm(e);
      d.moved = true;
      setDraft([Math.min(d.x0, nx), Math.min(d.y0, ny), Math.abs(nx - d.x0), Math.abs(ny - d.y0)]);
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved && view.s > 1) onView(limit(view.s, d.vx + dx, d.vy + dy));
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "select") {
      if (draft && draft[2] > 0.01 && draft[3] > 0.01) onSelection(draft);
      setDraft(null);
    } else if (!d.moved) {
      onTogglePlay();
    }
  }

  const pct = (v: number) => `${v * 100}%`;
  const boxStyle = (r: Roi) => ({ left: pct(r[0]), top: pct(r[1]), width: pct(r[2]), height: pct(r[3]) });
  const cls = ["stage", selectMode ? "selecting" : "", view.s > 1 ? "zoomed" : ""].join(" ");

  return (
    <div ref={outer} className={cls}>
      {src && (
        <div className="stage-content" style={content}>
          <div className="stage-inner" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
            <video ref={videoRef} src={src} preload="auto" playsInline />
            {filter && (
              <div className="box filter" style={boxStyle(filter)}>
                <span className="tag">filtro: só movimento aqui</span>
              </div>
            )}
            {selection && !selectMode && (
              <div className="box selection" style={boxStyle(selection)}>
                <span className="tag">seleção</span>
              </div>
            )}
            {draft && (
              <div className="box selection drawing" style={boxStyle(draft)}>
                <span className="size">
                  {Math.round(draft[2] * videoWidth)} × {Math.round(draft[3] * videoHeight)} px
                </span>
                <span className="handle" />
              </div>
            )}
            <div
              className="stage-hit"
              onWheel={onWheel}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onDoubleClick={() => onView(NO_ZOOM)}
            />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

/** Minimapa do zoom: quadro atual com a parte visível destacada. */
export function Minimap({ videoRef, view, contentAspect }: { videoRef: RefObject<HTMLVideoElement>; view: ZoomView; contentAspect: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const W = 176;
  const H = 88;
  const fit = W / H > contentAspect ? { w: H * contentAspect, h: H } : { w: W, h: W / contentAspect };
  const ox = (W - fit.w) / 2;
  const oy = (H - fit.h) / 2;

  useEffect(() => {
    const draw = () => {
      const v = videoRef.current;
      const c = canvas.current;
      if (!v || !c || v.readyState < 2) return;
      const g = c.getContext("2d")!;
      g.clearRect(0, 0, W, H);
      g.drawImage(v, ox, oy, fit.w, fit.h);
    };
    draw();
    const id = setInterval(draw, 400);
    return () => clearInterval(id);
  }, [videoRef, ox, oy, fit.w, fit.h]);

  // view.x/y estão em px do conteúdo; a fração visível é 1/s a partir de -x/(largura*s)
  const el = videoRef.current?.parentElement?.parentElement;
  const cw = el?.clientWidth || 1;
  const ch = el?.clientHeight || 1;
  const vx = -view.x / (cw * view.s);
  const vy = -view.y / (ch * view.s);
  return (
    <div className="minimap" aria-hidden="true">
      <canvas ref={canvas} width={W} height={H} />
      <div
        className="viewport"
        style={{ left: ox + vx * fit.w, top: oy + vy * fit.h, width: fit.w / view.s, height: fit.h / view.s }}
      />
    </div>
  );
}
