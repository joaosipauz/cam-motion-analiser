import { useEffect, useRef, useState } from "react";
import { Video } from "../api";
import { fmtClock, fmtDay, SOURCE_TEXT } from "../format";

interface Props {
  video: Video;
  time: number;
  onSave: (startTime: string | null) => Promise<void>;
}

/** Horário da cena com correção do início da gravação (DESIGN.md 4.3). */
export function SceneClock({ video, time, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const known = Boolean(video.start_time);

  return (
    <div className="scene-clock">
      <span className="label">{known ? "Horário da cena" : "Tempo desde o início do vídeo"}</span>
      <span className="time" aria-live="off">
        {fmtClock(video.start_time, time)}
      </span>
      <span className="origin">
        {known && (
          <>
            {fmtDay(video.start_time!, time)} · {SOURCE_TEXT[video.start_time_source ?? ""] ?? ""}
          </>
        )}
        <button className="link-btn" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {known ? "Está errado?" : "Informar horário"}
        </button>
      </span>
      {editing && (
        <StartTimePopover
          value={video.start_time}
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await onSave(v);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function StartTimePopover({
  value,
  onCancel,
  onSave,
}: {
  value: string | null;
  onCancel: () => void;
  onSave: (v: string | null) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const saved = useRef(false);

  useEffect(() => input.current?.focus(), []);

  function save() {
    if (saved.current) return;
    saved.current = true;
    onSave(input.current?.value || null);
  }

  return (
    <div
      className="popover"
      role="dialog"
      aria-label="Corrigir horário"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <span className="title">Quando a gravação começou?</span>
      <label htmlFor="start-time">Data e hora do início do vídeo</label>
      <input
        ref={input}
        id="start-time"
        className="field"
        type="datetime-local"
        step={1}
        defaultValue={value ?? ""}
        onKeyDown={(e) => e.key === "Enter" && save()}
        // regra do documento de funcionalidades: sair do campo também salva
        onBlur={(e) => {
          const next = e.relatedTarget as HTMLElement | null;
          if (!next?.closest(".popover")) save();
        }}
      />
      <span className="help t2">
        Dica: compare com o relógio que a câmera mostra na própria imagem. Vídeos recebidos pelo WhatsApp costumam ter no
        nome a hora em que foram enviados, não a da gravação.
      </span>
      <span className="help t3">Não sabe? Deixe em branco: o app mostra quanto tempo passou desde o começo do vídeo.</span>
      <div className="actions">
        <button className="btn ghost sm" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn primary sm" onClick={save}>
          Salvar horário
        </button>
      </div>
    </div>
  );
}
