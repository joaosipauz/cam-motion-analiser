import { PointerEvent, useEffect, useRef, useState, WheelEvent } from "react";
import { api, ApiError, EnhanceMode, FrameCandidate, Roi, Video } from "../api";
import { fmtPercent, fmtStamp } from "../format";
import { IconAlert, IconCheck, IconClose, IconDownload } from "../icons";
import { Modal } from "./Modal";

interface Props {
  video: Video;
  t: number;
  roi: Roi;
  onClose: () => void;
}

const AI_MODES: EnhanceMode[] = ["ia_forte", "swinir", "ia"];
const AI_INFO: Record<string, { name: string; time: string; desc: string }> = {
  ia_forte: { name: "IA forte", time: "~1,5 s", desc: "A mais nítida e equilibrada." },
  swinir: { name: "SwinIR", time: "~5 s", desc: "Imagem mais limpa, porém mais lenta." },
  ia: { name: "IA rápida", time: "~0,2 s", desc: "Melhora pouco, mas é instantânea." },
};

// modos de IA já usados nesta sessão (a primeira vez demora mais para preparar o modelo)
const warmed = new Set<EnhanceMode>();

const key = (mode: EnhanceMode, t: number) => `${mode}@${t.toFixed(3)}`;

function humanError(e: unknown) {
  const detail = e instanceof ApiError ? e.detail : String(e);
  if (e instanceof ApiError && e.status === 503)
    return { text: "Este modo de IA não está instalado neste computador. Use Fiel ou peça para instalar o modelo.", detail };
  if (/grande/i.test(detail))
    return {
      text: "Área grande demais para ampliar. Desenhe uma seleção menor (até cerca de 640 × 640 pixels do vídeo).",
      detail,
    };
  if (/pequena/i.test(detail)) return { text: "Área pequena demais. Desenhe uma seleção um pouco maior.", detail };
  return { text: "Não foi possível melhorar a imagem.", detail };
}

/** Janela "Melhorar imagem" (DESIGN.md 5). */
export function EnhanceDialog({ video, t, roi, onClose }: Props) {
  const [mode, setMode] = useState<EnhanceMode>("ia_forte");
  const [frameT, setFrameT] = useState(t);
  const [candidates, setCandidates] = useState<FrameCandidate[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; detail: string } | null>(null);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const k = key(mode, frameT);
  const isAi = AI_MODES.includes(mode);
  const areaW = Math.round(roi[2] * video.width);
  const areaH = Math.round(roi[3] * video.height);

  useEffect(() => {
    api
      .sharpest(video.id, t, roi)
      .then((c) => {
        setCandidates(c);
        const cur = c.find((f) => f.current);
        if (cur) setFrameT(cur.t);
      })
      .catch(() => setCandidates([]));
  }, [video.id, t, roi]);

  const searching = candidates === null;
  useEffect(() => {
    // espera a lista de imagens para não processar duas vezes a pausada
    if (urls[k] || searching) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .enhance(video.id, frameT, roi, mode)
      .then((blob) => {
        if (cancelled) return;
        warmed.add(mode);
        setUrls((u) => ({ ...u, [k]: URL.createObjectURL(blob) }));
      })
      .catch((e) => !cancelled && setError(humanError(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [k, searching]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  useEffect(() => () => Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u)), []);

  function onWheel(e: WheelEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left - r.width / 2;
    const py = e.clientY - r.top - r.height / 2;
    const s = Math.min(16, Math.max(0.5, view.s * (e.deltaY < 0 ? 1.25 : 0.8)));
    const f = s / view.s;
    setView({ s, x: px - (px - view.x) * f, y: py - (py - view.y) * f });
  }

  function onDown(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (d) setView({ ...view, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y });
  }

  function download() {
    const a = document.createElement("a");
    const stamp = fmtStamp(video.start_time, frameT).replace(/[/:]/g, "-").replace(" ", "_");
    a.href = urls[k];
    a.download = `melhoria_${stamp}_${mode}.png`;
    a.click();
  }

  const url = urls[k];
  const radio = (m: EnhanceMode) => ({
    role: "radio" as const,
    "aria-checked": mode === m,
    onClick: () => setMode(m),
  });

  return (
    <Modal label="Melhorar imagem" className="enhance-dialog" onClose={onClose}>
      <div className="dialog-head">
        <div className="titles">
          <h2>Melhorar imagem</h2>
          <span className="mono t2" style={{ fontSize: 13 }}>
            {fmtStamp(video.start_time, frameT)}
          </span>
          <span className="t3" style={{ fontSize: 12 }}>
            área de {areaW}×{areaH} pixels · ampliada 4 vezes
          </span>
        </div>
        <button className="icon-btn" aria-label="Fechar (Esc)" onClick={onClose}>
          <IconClose />
        </button>
      </div>

      <div className="enhance-body">
        <div className="modes" role="radiogroup" aria-label="Como melhorar">
          <span className="caption">Como melhorar</span>
          <button className="mode faithful" {...radio("fiel")}>
            <span className="top">
              <span className="name">Fiel</span>
              <span className="time">~0,2 s</span>
            </span>
            <span className="trusted">
              <IconCheck />
              Confiável para prova
            </span>
            <span className="desc">
              Junta ~15 imagens vizinhas. Não inventa nada: usa só o que a câmera gravou. Melhor para coisas paradas, como placa
              de carro estacionado.
            </span>
          </button>
          <span className="ai-sep">Com inteligência artificial · podem inventar detalhes</span>
          {AI_MODES.map((m) => (
            <button key={m} className="mode" {...radio(m)}>
              <span className="top">
                <span className="name">{AI_INFO[m].name}</span>
                <span className="time">{AI_INFO[m].time}</span>
              </span>
              <span className="desc">{AI_INFO[m].desc}</span>
            </button>
          ))}
          <hr />
          <button className="mode original" {...radio("bicubic")}>
            <span className="name">Original</span>
            <span className="desc">sem tratamento, para comparar</span>
          </button>
        </div>

        <div className="enhance-main">
          {isAi && (
            <div className="ai-alert" role="alert">
              <IconAlert size={22} />
              <div>
                <strong className="title">Atenção: imagem criada por inteligência artificial</strong>
                <span className="text">
                  A IA pode desenhar letras de placa ou traços de rosto que não existem. Não use como prova. Para um registro
                  confiável, escolha <strong>Fiel</strong>.
                </span>
              </div>
            </div>
          )}

          <div
            className="viewer"
            onWheel={onWheel}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onDoubleClick={() => setView({ s: 1, x: 0, y: 0 })}
          >
            {(loading || searching) && !error && (
              <div className="state" role="status">
                {isAi && !warmed.has(mode)
                  ? "Preparando a inteligência artificial… pode levar alguns segundos a mais"
                  : "Melhorando a imagem…"}
              </div>
            )}
            {error && (
              <div className="error-box" role="alert" style={{ maxWidth: 520 }}>
                <IconAlert />
                <span className="msg">
                  <span>{error.text}</span>
                  <span className="tech">Detalhe técnico: {error.detail}</span>
                </span>
              </div>
            )}
            {url && !loading && !error && (
              <>
                <img
                  src={url}
                  alt="Imagem ampliada da área selecionada"
                  draggable={false}
                  style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
                />
                {isAi && <span className="ai-badge">IA · pode conter detalhes inventados</span>}
                <span className="zoom-info">
                  {view.s.toFixed(1)}x · role para ampliar · clique duas vezes para ajustar
                </span>
              </>
            )}
          </div>

          <div className="frames">
            <div className="head">
              <span className="t2">Escolha a imagem: a pausada e as 4 mais nítidas entre 2 s antes e 2 s depois</span>
              <span className="t3">ao trocar, a melhoria é refeita</span>
            </div>
            {searching ? (
              <span className="t3" style={{ fontSize: 12 }} role="status">
                Procurando as imagens mais nítidas…
              </span>
            ) : (
              <div className="row">
                {candidates!.map((c) => (
                  <button
                    key={c.t}
                    className="frame-opt"
                    aria-pressed={c.t === frameT}
                    onClick={() => setFrameT(c.t)}
                    title={c.current ? "Imagem em que o vídeo foi pausado" : "Imagem mais nítida próxima"}
                  >
                    <img src={api.frameUrl(video.id, c.t, 160, roi)} alt="" />
                    <span className="line">
                      <span>
                        {c.current ? "pausado" : `${c.t > t ? "+" : "−"}${Math.abs(c.t - t).toFixed(2).replace(".", ",")} s`}
                      </span>
                      <span className="t3">{fmtPercent(c.sharpness, 0)}</span>
                    </span>
                    <span className="bar">
                      <span style={{ width: `${c.sharpness * 100}%` }} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dialog-foot">
        <span>O arquivo PNG guarda junto o nome do vídeo, o horário, a área, o modo usado e se a IA criou detalhes.</span>
        <button className="btn primary" disabled={!url || loading} onClick={download}>
          <IconDownload />
          Baixar PNG
        </button>
      </div>
    </Modal>
  );
}
