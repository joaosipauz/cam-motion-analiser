import { ReactNode } from "react";
import { fmtClock } from "../format";
import { SPEEDS } from "../shortcuts";
import {
  IconAlert,
  IconChain,
  IconChevronLeft,
  IconChevronRight,
  IconNextMotion,
  IconPause,
  IconPlay,
  IconPrevMotion,
  IconStar,
} from "../icons";

interface Props {
  timeline: ReactNode;
  searchState: "searching" | "done" | "failed";
  searchProgress: number;
  failureDetail: string | null;
  onRetry: () => void;
  playable: boolean;
  paused: boolean;
  counter: string;
  zoom: number;
  speed: number;
  startTime: string | null;
  clipIn: number | null;
  clipOut: number | null;
  onSpeed: (s: number) => void;
  chain: boolean;
  onChain: () => void;
  favoriteActive: boolean;
  favoriteHint: string;
  onFavorite: () => void;
  onTogglePlay: () => void;
  onFrame: (dir: 1 | -1) => void;
  onJump: (dir: 1 | -1) => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
}

/** Barra inferior sobre o vídeo: linha do tempo e controles (DESIGN.md 4.7). */
export function BottomBar(p: Props) {
  const canJump = p.searchState === "done";
  return (
    <div className="bottom-bar">
      {p.searchState === "done" && p.timeline}
      {p.searchState === "searching" && (
        <div className="scan-progress" role="status">
          <span className="row">
            <span>Procurando movimentos… {Math.round(p.searchProgress * 100)}%</span>
            <span className="t2">Você já pode assistir. A linha do tempo aparece quando terminar.</span>
          </span>
          <span className="progress">
            <span style={{ width: `${p.searchProgress * 100}%` }} />
          </span>
        </div>
      )}
      {p.searchState === "failed" && (
        <div className="error-box" role="alert">
          <IconAlert />
          <span className="msg">
            <span>Não foi possível terminar a busca por movimentos. Você ainda pode assistir e salvar trechos.</span>
            {p.failureDetail && <span className="tech">Detalhe técnico: {p.failureDetail}</span>}
          </span>
          <button className="btn danger sm" onClick={p.onRetry}>
            Tentar de novo
          </button>
        </div>
      )}
      <div className="controls">
        <div className="group">
          <button
            className="ctl frame"
            aria-label="Quadro anterior (vírgula)"
            title="Quadro anterior ( , )"
            disabled={!p.playable}
            onClick={() => p.onFrame(-1)}
          >
            <IconChevronLeft />
          </button>
          <button
            className="ctl"
            aria-label="Movimento anterior (P)"
            title="Movimento anterior (P)"
            disabled={!canJump}
            onClick={() => p.onJump(-1)}
          >
            <IconPrevMotion />
          </button>
          <button
            className="play-btn"
            aria-label={p.paused ? "Tocar (Espaço)" : "Pausar (Espaço)"}
            title="Tocar ou pausar (Espaço)"
            disabled={!p.playable}
            onClick={p.onTogglePlay}
          >
            {p.paused ? <IconPlay /> : <IconPause />}
          </button>
          <button
            className="ctl"
            aria-label="Próximo movimento (N)"
            title="Próximo movimento (N)"
            disabled={!canJump}
            onClick={() => p.onJump(1)}
          >
            <IconNextMotion />
          </button>
          <button
            className="ctl frame"
            aria-label="Próximo quadro (ponto)"
            title="Próximo quadro ( . )"
            disabled={!p.playable}
            onClick={() => p.onFrame(1)}
          >
            <IconChevronRight />
          </button>
          <span className="counter">{p.counter}</span>
          <button
            className="chain-btn"
            aria-pressed={p.chain}
            disabled={!canJump}
            onClick={p.onChain}
            title="Ao terminar um momento, pula a parte parada e toca o próximo (A)"
          >
            <IconChain />
            Emendar momentos
          </button>
        </div>
        <div className="group">
          <div className="speed" role="radiogroup" aria-label="Velocidade" title="Velocidade (− e +)">
            <span className="speed-label">Velocidade</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={p.speed === s}
                disabled={!p.playable}
                onClick={() => p.onSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          {p.zoom > 1 && <span className="chip">{p.zoom.toFixed(1)}x</span>}
          <button
            className="fav-btn"
            aria-pressed={p.favoriteActive}
            disabled={!p.playable}
            onClick={p.onFavorite}
            title={`${p.favoriteHint} (M)`}
          >
            <IconStar filled={p.favoriteActive} />
            {p.favoriteActive ? "Favoritado" : "Favoritar"}
          </button>
          <button className="mark-btn" onClick={p.onMarkIn} title="Marca o ponto atual como início (I)">
            <span className="k">Início do trecho · I</span>
            <span className="v">{p.clipIn !== null ? fmtClock(p.startTime, p.clipIn) : "--:--:--"}</span>
          </button>
          <button className="mark-btn" onClick={p.onMarkOut} title="Marca o ponto atual como fim (O)">
            <span className="k">Fim do trecho · O</span>
            <span className="v">{p.clipOut !== null ? fmtClock(p.startTime, p.clipOut) : "--:--:--"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
