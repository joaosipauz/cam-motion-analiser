import { PointerEvent, useEffect, useRef, useState } from "react";
import { AiModel, api, ApiError, ExportMode, Job, Motion, Roi, Video } from "../api";
import { fmtClock, fmtElapsed, fmtInt, shortDuration } from "../format";
import { IconAlert, IconClose, IconDownload, IconLoop, IconPause, IconPlay, IconPrevMotion } from "../icons";
import { Modal } from "./Modal";

interface Props {
  video: Video;
  start: number;
  end: number;
  selection: Roi | null;
  filter: Roi | null;
  threshold: number;
  jobs: Job[];
  onRange: (start: number, end: number) => void;
  onJob: (job: Job) => void;
  onClose: () => void;
}

const TYPES: { id: ExportMode; name: string; time: string; desc: string }[] = [
  { id: "fast", name: "Rápido", time: "segundos", desc: "Recorta sem perder qualidade. Pode começar alguns segundos antes do marcado." },
  { id: "precise", name: "Corte exato", time: "alguns segundos", desc: "Começa e termina exatamente onde você marcou. Um pouco mais lento." },
  {
    id: "enhanced",
    name: "Melhorar com IA",
    time: "pode demorar",
    desc: "Gera um vídeo só da área selecionada, ampliado 4 vezes com inteligência artificial.",
  },
];

// segundos por imagem [mínimo, máximo] medidos no i7-8700 + UHD 630; null = "ou mais"
const MODELS: { id: AiModel; name: string; perFrame: [number, number | null] }[] = [
  { id: "ia", name: "IA rápida", perFrame: [0.1, 0.1] },
  { id: "ia_forte", name: "IA forte", perFrame: [1, 2] },
  { id: "swinir", name: "SwinIR", perFrame: [3, null] },
];

function fmtWait(s: number) {
  if (s < 60) return `${Math.max(1, Math.round(s))} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = s / 3600;
  return h < 1.5 ? "1 h" : `${Math.round(h)} h`;
}

function estimate(frames: number, [lo, hi]: [number, number | null]) {
  if (hi === null) return `${fmtWait(frames * lo)} ou mais`;
  if (lo === hi) return `~${fmtWait(frames * lo)}`;
  const a = fmtWait(frames * lo);
  const b = fmtWait(frames * hi);
  const unit = (x: string) => x.split(" ")[1];
  return unit(a) === unit(b) ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
}

const MODE_NAME: Record<string, string> = { fast: "Rápido", precise: "Corte exato", enhanced: "Melhorar com IA" };

/** Janela "Salvar trecho" com prévia (DESIGN.md 6). */
export function SaveDialog(p: Props) {
  const { video, selection, filter, threshold } = p;
  const dur = video.duration;
  const fps = video.fps || 15;
  const [start, setStart] = useState(p.start);
  const [end, setEnd] = useState(p.end);
  const [type, setType] = useState<ExportMode>("fast");
  const [model, setModel] = useState<AiModel>("ia");
  const [cutAt, setCutAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<{ text: string; detail: string } | null>(null);
  const [sentHere, setSentHere] = useState(false);
  const length = Math.max(0, end - start);
  const frames = Math.round(length * fps);

  // sincroniza o trecho com a tela principal
  useEffect(() => p.onRange(start, end), [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  // corte rápido: onde o arquivo realmente começa (keyframe anterior)
  useEffect(() => {
    if (type !== "fast") return;
    setCutAt(null);
    const id = setTimeout(() => {
      api
        .keyframe(video.id, start)
        .then((r) => setCutAt(r.t))
        .catch(() => setCutAt(null));
    }, 200);
    return () => clearTimeout(id);
  }, [type, start, video.id]);

  const invalid = end <= start ? "O fim precisa ser depois do início." : end > dur + 0.5 ? "O fim passa do final do vídeo." : null;
  const needsSelection = type === "enhanced" && !selection;
  const currentModel = MODELS.find((m) => m.id === model)!;
  const eta = estimate(frames, currentModel.perFrame);

  async function submit() {
    setSubmitError(null);
    try {
      const { job_id } = await api.exportClip(video.id, {
        start,
        end,
        mode: type,
        roi: type === "enhanced" ? selection : null,
        model,
      });
      p.onJob(await api.job(job_id));
      setSentHere(true);
    } catch (e) {
      setSubmitError({
        text: "Não foi possível salvar o trecho.",
        detail: e instanceof ApiError ? e.detail : String(e),
      });
    }
  }

  const cta = sentHere
    ? "Salvar de novo"
    : type === "enhanced"
      ? `Salvar · leva ${eta}`
      : `Salvar trecho de ${shortDuration(length)}`;

  return (
    <Modal label="Salvar trecho" className="save-dialog" onClose={p.onClose}>
      <div className="dialog-head">
        <div className="titles">
          <h2>Salvar trecho</h2>
          <span className="mono t2" style={{ fontSize: 13 }}>
            {video.name}
          </span>
        </div>
        <button className="icon-btn" aria-label="Fechar (Esc)" onClick={p.onClose}>
          <IconClose />
        </button>
      </div>

      <div className="save-body">
        <Preview
          video={video}
          start={start}
          end={end}
          setStart={setStart}
          setEnd={setEnd}
          selection={type === "enhanced" ? selection : null}
          filter={filter}
          threshold={threshold}
          note={
            type === "enhanced"
              ? "mostrando sem melhoria · só a área destacada vai para o arquivo"
              : "é exatamente isto que será salvo"
          }
        />

        <section className="options" aria-label="Como salvar">
          <span className="caption">Como salvar</span>
          <div role="radiogroup" aria-label="Como salvar" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TYPES.map((t) => {
              const disabled = t.id === "enhanced" && !selection;
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={type === t.id}
                  className="option"
                  disabled={disabled}
                  onClick={() => setType(t.id)}
                >
                  <span className="top">
                    <span className="name">{t.name}</span>
                    <span className="time">{t.time}</span>
                  </span>
                  <span className="desc">{t.desc}</span>
                  {disabled && <span className="why">Desenhe uma seleção no vídeo para usar esta opção.</span>}
                </button>
              );
            })}
          </div>

          {type === "fast" && cutAt !== null && (
            <div className="notice-amber">
              {start - cutAt < 0.05
                ? "O arquivo começa exatamente no ponto marcado."
                : `Neste modo o vídeo só pode ser cortado em alguns pontos. Por isso o arquivo vai começar em ${fmtClock(
                    video.start_time,
                    cutAt,
                  )}, ${
                    start - cutAt < 1 ? `${(start - cutAt).toFixed(1).replace(".", ",")} s` : shortDuration(start - cutAt)
                  } antes do marcado.`}
            </div>
          )}

          {type === "enhanced" && selection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="caption">
                Qualidade da IA · {fmtInt(frames)} imagens para tratar ({shortDuration(length)} de vídeo)
              </span>
              <div className="segmented" role="radiogroup" aria-label="Qualidade da IA">
                {MODELS.map((m) => (
                  <button key={m.id} role="radio" aria-checked={model === m.id} onClick={() => setModel(m.id)}>
                    {m.name}
                  </button>
                ))}
              </div>
              <div className="estimate">
                <span className="t2" style={{ fontSize: 12 }}>
                  Tempo estimado
                </span>
                <span className="v">{eta}</span>
              </div>
              <div className="notice-danger" role="alert">
                A IA pode desenhar letras de placa ou traços de rosto que não existem. Não use este vídeo como prova.
              </div>
            </div>
          )}

          <div className="save-actions">
            {p.jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
            {submitError && (
              <div className="error-box" role="alert">
                <IconAlert />
                <span className="msg">
                  <span>{submitError.text}</span>
                  <span className="tech">Detalhe técnico: {submitError.detail}</span>
                </span>
              </div>
            )}
            {invalid && (
              <span className="error-box" role="alert">
                <span className="msg">{invalid}</span>
              </span>
            )}
            <button className="btn motion" style={{ height: 44, fontSize: 14 }} disabled={Boolean(invalid) || needsSelection} onClick={submit}>
              {cta}
            </button>
            <button className="btn ghost" onClick={p.onClose}>
              Cancelar
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function JobCard({ job }: { job: Job }) {
  const name = MODE_NAME[String(job.params.mode)] ?? "";
  if (job.status === "done" && job.result) {
    const file = String(job.result.file);
    return (
      <div className="job-card">
        <span className="row">
          <span>Salvo</span>
          <span className="t3">{name}</span>
        </span>
        <a href={api.exportUrl(file)} download>
          <IconDownload size={14} /> {file}
        </a>
      </div>
    );
  }
  if (job.status === "error") {
    return (
      <div className="error-box" role="alert">
        <IconAlert />
        <span className="msg">
          <span>Não foi possível salvar o trecho.</span>
          <span className="tech">Detalhe técnico: {job.message}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="job-card" role="status">
      <span className="row">
        <span>Salvando… {Math.round(job.progress * 100)}%</span>
        <span className="t3">{name}</span>
      </span>
      <span className="progress">
        <span style={{ width: `${job.progress * 100}%` }} />
      </span>
      <span className="t3" style={{ fontSize: 11 }}>
        Pode fechar esta janela: o app continua salvando por trás.
      </span>
    </div>
  );
}

// --- prévia ---------------------------------------------------------------------

interface PreviewProps {
  video: Video;
  start: number;
  end: number;
  setStart: (v: number) => void;
  setEnd: (v: number) => void;
  selection: Roi | null;
  filter: Roi | null;
  threshold: number;
  note: string;
}

const PAD = 14; // espaço das alças nas pontas da barra

function Preview({ video, start, end, setStart, setEnd, selection, filter, threshold, note }: PreviewProps) {
  const dur = video.duration;
  const fps = video.fps || 15;
  const ref = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [bins, setBins] = useState<Motion | null>(null);
  const drag = useRef<"start" | "end" | "seek" | null>(null);
  const range = useRef({ start, end, loop });
  range.current = { start, end, loop };

  // domínio da barra: o trecho com uma folga dos dois lados
  const [dom, setDom] = useState(() => {
    const L = Math.max(4, end - start);
    return { a: Math.max(0, start - L * 0.25), b: Math.min(dur, end + L * 0.25) };
  });
  useEffect(() => {
    // amplia o domínio só quando o trecho sai dele
    if (start < dom.a || end > dom.b) {
      const L = Math.max(4, end - start);
      setDom({ a: Math.max(0, start - L * 0.25), b: Math.min(dur, end + L * 0.25) });
    }
  }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api
      .motionRange(video.id, filter, dom.a, dom.b, 80)
      .then(setBins)
      .catch(() => setBins(null));
  }, [video.id, filter, dom.a, dom.b]);

  // reprodução presa ao trecho
  useEffect(() => {
    const v = ref.current!;
    let raf = 0;
    const tick = () => {
      const r = range.current;
      if (v.currentTime >= r.end) {
        if (r.loop) v.currentTime = r.start;
        else v.pause();
      }
      setT(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      setT(v.currentTime);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.currentTime = start;
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function seek(x: number) {
    const v = ref.current!;
    v.currentTime = x;
    setT(x);
  }

  function togglePlay() {
    const v = ref.current!;
    if (!v.paused) return v.pause();
    if (v.currentTime >= end - 0.05 || v.currentTime < start) v.currentTime = start;
    v.play();
  }

  // barra do trecho
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const inner = w - PAD * 2;
    const x = (s: number) => PAD + ((s - dom.a) / (dom.b - dom.a)) * inner;
    if (bins) {
      const n = bins.bins.length;
      const peak = Math.max(threshold * 2, ...bins.bins);
      const bw = inner / n;
      bins.bins.forEach((v, i) => {
        const bt = dom.a + ((i + 0.5) / n) * (dom.b - dom.a);
        const inside = bt >= start && bt <= end;
        const past = bt <= t;
        const hot = v >= threshold;
        const bh = Math.max(3, Math.min(1, Math.sqrt(v / peak)) * (h - 8));
        g.fillStyle = !inside
          ? "rgba(58,67,80,0.5)"
          : hot
            ? past
              ? "#F2994A"
              : "rgba(242,153,74,0.55)"
            : past
              ? "#5A6370"
              : "#3A4350";
        g.fillRect(PAD + i * bw, h - bh, Math.max(1, bw - 2), bh);
      });
    }
    // fora do trecho fica escurecido
    g.fillStyle = "rgba(14,17,22,0.55)";
    g.fillRect(0, 0, x(start), h);
    g.fillRect(x(end), 0, w - x(end), h);
    // alças
    g.fillStyle = "#E6EAF0";
    g.fillRect(x(start) - 10, 0, 10, h);
    g.fillRect(x(end), 0, 10, h);
    // reprodução
    g.fillStyle = "#FFFFFF";
    g.fillRect(x(t) - 1, 0, 2, h);
  }, [bins, dom, start, end, t, threshold]);

  function timeAt(clientX: number) {
    const r = canvas.current!.getBoundingClientRect();
    const f = (clientX - r.left - PAD) / (r.width - PAD * 2);
    return Math.max(0, Math.min(dur, dom.a + f * (dom.b - dom.a)));
  }

  function onDown(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const r = canvas.current!.getBoundingClientRect();
    const px = (s: number) => r.left + PAD + ((s - dom.a) / (dom.b - dom.a)) * (r.width - PAD * 2);
    if (Math.abs(e.clientX - (px(start) - 5)) < 14) drag.current = "start";
    else if (Math.abs(e.clientX - (px(end) + 5)) < 14) drag.current = "end";
    else {
      drag.current = "seek";
      seek(Math.min(end, Math.max(start, timeAt(e.clientX))));
    }
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const x = timeAt(e.clientX);
    if (d === "start") setStart(Math.min(x, end - 1 / fps));
    else if (d === "end") setEnd(Math.max(x, start + 1 / fps));
    else seek(Math.min(end, Math.max(start, x)));
  }

  const step = (e: React.MouseEvent) => (e.shiftKey ? 1 / fps : 1);
  const clampT = (v: number) => Math.max(0, Math.min(dur, v));

  return (
    <section className="preview" aria-label="Prévia do trecho">
      <div className="head">
        <span>Prévia</span>
        <span>{note}</span>
      </div>
      <div className="preview-video" style={{ aspectRatio: `${video.width} / ${video.height}`, maxHeight: 400 }}>
        <video ref={ref} src={api.streamUrl(video.id)} preload="auto" playsInline onClick={togglePlay} />
        <span className="clock">{fmtClock(video.start_time, t)}</span>
        {selection && (
          <div
            className="only-area"
            style={{
              left: `${selection[0] * 100}%`,
              top: `${selection[1] * 100}%`,
              width: `${selection[2] * 100}%`,
              height: `${selection[3] * 100}%`,
            }}
          >
            <span>só esta área será salva · ampliada 4 vezes</span>
          </div>
        )}
        {!playing && (
          <button className="big-play" aria-label="Reproduzir prévia" onClick={togglePlay}>
            <IconPlay size={24} />
          </button>
        )}
      </div>

      <div className="preview-controls">
        <button className="round-play" aria-label={playing ? "Pausar prévia" : "Reproduzir prévia"} onClick={togglePlay}>
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <button className="square-btn" aria-label="Voltar ao início do trecho" title="Voltar ao início do trecho" onClick={() => seek(start)}>
          <IconPrevMotion size={16} />
        </button>
        <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>
          {fmtClock(video.start_time, t)}
        </span>
        <span className="mono t3" style={{ fontSize: 12 }}>
          {fmtElapsed(Math.max(0, t - start)).slice(3)} / {fmtElapsed(end - start).slice(3)}
        </span>
        <button className="toggle" style={{ marginLeft: "auto" }} aria-pressed={loop} onClick={() => setLoop(!loop)}>
          <IconLoop />
          Repetir
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="range-bar">
          <canvas
            ref={canvas}
            aria-label="Trecho marcado. Arraste as pontas brancas para ajustar."
            role="img"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
          />
        </div>
        <div className="range-edit">
          <div className="end">
            <button className="square-btn sm" aria-label="Início 1 s antes" title="Shift: 1 quadro" onClick={(e) => setStart(clampT(start - step(e)))}>
              −
            </button>
            <span className="val">
              <span className="k">Início</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {fmtClock(video.start_time, start)}
              </span>
            </span>
            <button
              className="square-btn sm"
              aria-label="Início 1 s depois"
              title="Shift: 1 quadro"
              onClick={(e) => setStart(Math.min(end - 1 / fps, start + step(e)))}
            >
              +
            </button>
          </div>
          <span className="t3" style={{ fontSize: 12 }}>
            arraste as pontas brancas para ajustar
          </span>
          <div className="end">
            <button
              className="square-btn sm"
              aria-label="Fim 1 s antes"
              title="Shift: 1 quadro"
              onClick={(e) => setEnd(Math.max(start + 1 / fps, end - step(e)))}
            >
              −
            </button>
            <span className="val" style={{ textAlign: "right" }}>
              <span className="k">Fim</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {fmtClock(video.start_time, end)}
              </span>
            </span>
            <button className="square-btn sm" aria-label="Fim 1 s depois" title="Shift: 1 quadro" onClick={(e) => setEnd(clampT(end + step(e)))}>
              +
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
