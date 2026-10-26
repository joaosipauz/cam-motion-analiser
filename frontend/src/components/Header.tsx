import { Video } from "../api";
import { fmtPercent, videoSummary, videoTechnical } from "../format";
import { IconCamera, IconChevronDown, IconDownload, IconFolder } from "../icons";

export const THRESHOLDS = [0.12, 0.08, 0.05, 0.035, 0.025, 0.018, 0.012, 0.008, 0.005, 0.003];

interface Props {
  video: Video | null;
  status: "searching" | "done" | "failed" | null;
  searchProgress: number;
  sensitivity: number;
  onSensitivity: (v: number) => void;
  onOpenLibrary: () => void;
  onOpenSave?: () => void;
  savingCount: number;
}

export function Header(props: Props) {
  const { video, status, searchProgress, sensitivity, onSensitivity, onOpenLibrary, onOpenSave, savingCount } = props;
  return (
    <header className="header">
      <div className="group">
        <span className="logo">
          <IconCamera />
        </span>
        <button
          className="btn video-picker"
          onClick={onOpenLibrary}
          aria-haspopup="dialog"
          title="Trocar de vídeo (B)"
        >
          <IconFolder />
          <span className="name">{video ? video.name : "Nenhum vídeo aberto"}</span>
          <IconChevronDown />
        </button>
        {video && (
          <span className="summary" title={videoTechnical(video)}>
            {videoSummary(video).replace(" · ", " de gravação · ")} · {Math.round(video.fps)} quadros por segundo
          </span>
        )}
      </div>
      {video && (
        <div className="group">
          {status === "done" && (
            <div className="sensitivity">
              <label htmlFor="sensitivity">Sensibilidade</label>
              <span>menos</span>
              <input
                id="sensitivity"
                type="range"
                min={1}
                max={10}
                value={sensitivity}
                aria-describedby="sensitivity-hint"
                title="Atalhos: [ e ]"
                onChange={(e) => onSensitivity(Number(e.target.value))}
              />
              <span>mais</span>
              <span className="value">{sensitivity}</span>
              <span id="sensitivity-hint">
                detecta movimentos a partir de {fmtPercent(THRESHOLDS[sensitivity - 1])} da imagem
              </span>
            </div>
          )}
          {status === "searching" && (
            <span className="status-dot" role="status">
              Procurando movimentos no vídeo · {Math.round(searchProgress * 100)}%
            </span>
          )}
          {status === "failed" && <span className="status-dot fail">A busca por movimentos falhou</span>}
          <button className="btn" onClick={onOpenSave} title="Salvar trecho (X)">
            <IconDownload />
            Salvar trecho{savingCount > 0 ? ` · ${savingCount} salvando` : ""}
          </button>
        </div>
      )}
    </header>
  );
}
