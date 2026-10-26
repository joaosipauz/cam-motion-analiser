import { PointerEvent, useEffect, useRef, useState, WheelEvent } from "react";
import { api, Favorite, Motion } from "../api";
import { fmtClock } from "../format";

interface Props {
  videoId: string;
  duration: number;
  motion: Motion;
  threshold: number;
  time: number;
  startTime: string | null;
  clipIn: number | null;
  clipOut: number | null;
  favorites: Favorite[];
  onSeek: (t: number) => void;
}

const TICKS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
const BARS_H = 40;
const AXIS_H = 16;
const HEIGHT = BARS_H + AXIS_H;

/** Linha do tempo compacta em canvas: aguenta 12 h de vídeo e milhares de momentos. */
export function Timeline(props: Props) {
  const { videoId, duration, motion, threshold, time, startTime, clipIn, clipOut, favorites, onSeek } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ a: 0, b: duration });
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [thumbT, setThumbT] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ x: number; a: number; b: number; moved: boolean } | null>(null);

  useEffect(() => setView({ a: 0, b: duration }), [duration]);

  useEffect(() => {
    const el = canvas.current!;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a janela acompanha a reprodução quando ela sai da parte visível
  useEffect(() => {
    if (time < view.a || time > view.b) {
      const span = view.b - view.a;
      const a = Math.max(0, Math.min(duration - span, time - span * 0.1));
      setView({ a, b: a + span });
    }
  }, [time]); // eslint-disable-line react-hooks/exhaustive-deps

  // miniatura com atraso curto, para não pedir um quadro por pixel
  useEffect(() => {
    if (!hover) return setThumbT(null);
    const id = setTimeout(() => setThumbT(Math.round(hover.t)), 100);
    return () => clearTimeout(id);
  }, [hover]);

  useEffect(() => {
    const c = canvas.current!;
    if (!width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = HEIGHT * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const color = (n: string) => css.getPropertyValue(n).trim();
    const { a, b } = view;
    const x = (t: number) => ((t - a) / (b - a)) * width;

    // faixas de momento sob as barras
    g.fillStyle = "rgba(242,153,74,0.12)";
    for (const s of motion.segments) {
      if (s.end < a || s.start > b) continue;
      g.fillRect(x(s.start), 0, Math.max(1, x(s.end) - x(s.start)), BARS_H);
    }

    // barras: escala relativa ao pico visível
    const n = motion.bins.length;
    const binDur = duration / n;
    const i0 = Math.max(0, Math.floor(a / binDur));
    const i1 = Math.min(n - 1, Math.ceil(b / binDur));
    let peak = 0;
    for (let i = i0; i <= i1; i++) peak = Math.max(peak, motion.bins[i]);
    const ref = Math.max(peak, threshold * 2);
    const hot = color("--motion");
    const idle = color("--motion-idle");
    for (let i = i0; i <= i1; i++) {
      const v = motion.bins[i];
      const h = Math.max(2, Math.min(1, Math.sqrt(v / ref)) * BARS_H);
      g.fillStyle = v >= threshold ? hot : idle;
      const x0 = x(i * binDur);
      g.fillRect(x0, BARS_H - h, Math.max(1, x((i + 1) * binDur) - x0 - 1), h);
    }

    // favoritos: faixa no topo e um losango no início
    const favColor = color("--favorite");
    g.fillStyle = favColor;
    for (const f of favorites) {
      if (f.end < a || f.start > b) continue;
      const x0 = x(f.start);
      g.globalAlpha = 0.35;
      g.fillRect(x0, 0, Math.max(2, x(f.end) - x0), 3);
      g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + 4, 4);
      g.lineTo(x0, 8);
      g.lineTo(x0 - 4, 4);
      g.closePath();
      g.fill();
    }

    // trecho para salvar
    if (clipIn !== null || clipOut !== null) {
      const s = clipIn ?? 0;
      const e = clipOut ?? duration;
      g.fillStyle = "rgba(230,234,240,0.16)";
      g.fillRect(x(Math.min(s, e)), 0, Math.abs(x(e) - x(s)), BARS_H);
    }

    // marcas de horário real, alinhadas ao relógio
    const span = b - a;
    const step = TICKS.find((s) => span / s <= width / 90) ?? 14400;
    const offset = startTime ? secondsOfDay(startTime) : 0;
    g.fillStyle = color("--text-2");
    g.font = "11px 'IBM Plex Mono', monospace";
    g.textBaseline = "bottom";
    g.textAlign = "center";
    for (let t = Math.ceil((a + offset) / step) * step - offset; t <= b; t += step) {
      const px = x(t);
      g.fillRect(Math.round(px), BARS_H, 1, 3);
      if (px > 24 && px < width - 24) g.fillText(fmtClock(startTime, t), px, HEIGHT);
    }

    // cursor de reprodução
    g.fillStyle = "#ffffff";
    g.fillRect(Math.round(x(time)) - 1, 0, 2, BARS_H);
  }, [view, motion, threshold, time, startTime, clipIn, clipOut, duration, width, favorites]);

  function tAt(clientX: number) {
    const r = canvas.current!.getBoundingClientRect();
    return view.a + ((clientX - r.left) / r.width) * (view.b - view.a);
  }

  function onWheel(e: WheelEvent) {
    const t = tAt(e.clientX);
    const span = view.b - view.a;
    const next = Math.min(duration, Math.max(10, span * (e.deltaY < 0 ? 0.7 : 1.4)));
    const frac = (t - view.a) / span;
    const a = Math.max(0, Math.min(duration - next, t - frac * next));
    setView({ a, b: a + next });
  }

  function onDown(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, a: view.a, b: view.b, moved: false };
  }

  function onMove(e: PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    setHover({ x: e.clientX - r.left, t: Math.max(0, Math.min(duration, tAt(e.clientX))) });
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    if (d.moved) {
      const span = d.b - d.a;
      const a = Math.max(0, Math.min(duration - span, d.a - (dx / r.width) * span));
      setView({ a, b: a + span });
    }
  }

  function onUp(e: PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) onSeek(Math.max(0, Math.min(duration, tAt(e.clientX))));
  }

  const zoomed = view.b - view.a < duration - 1;

  return (
    <div className="timeline">
      <canvas
        ref={canvas}
        style={{ height: HEIGHT }}
        title="Barras laranja: movimento. Clique para ir até o momento, role para aproximar."
        aria-label="Linha do tempo com o movimento do vídeo"
        role="img"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => setHover(null)}
      />
      {hover && (
        <div className="tl-hover" style={{ left: Math.min(Math.max(hover.x, 104), Math.max(104, width - 104)) }}>
          {thumbT !== null && <img src={api.frameUrl(videoId, thumbT, 200)} alt="" />}
          <span>{fmtClock(startTime, hover.t)}</span>
        </div>
      )}
      {zoomed && (
        <button
          className="btn sm"
          style={{ position: "absolute", right: 0, bottom: -2, height: 20, padding: "0 8px", fontSize: 11 }}
          onClick={() => setView({ a: 0, b: duration })}
        >
          Ver tudo
        </button>
      )}
    </div>
  );
}

function secondsOfDay(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}
