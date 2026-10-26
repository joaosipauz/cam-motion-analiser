import { useCallback, useEffect, useRef, useState } from "react";
import { api, Favorite, Job, Motion, Roi, Segment, Video } from "../api";
import { IconCamera, IconStar } from "../icons";
import { shortcutsBlocked, SPEEDS } from "../shortcuts";
import { AreaTools } from "./AreaTools";
import { BottomBar } from "./BottomBar";
import { EnhanceDialog } from "./EnhanceDialog";
import { Header, THRESHOLDS } from "./Header";
import { Moments } from "./Moments";
import { SaveDialog } from "./SaveDialog";
import { SceneClock } from "./SceneClock";
import { ShortcutLegend } from "./Shortcuts";
import { Minimap, NO_ZOOM, Stage, ZoomView } from "./Stage";
import { Timeline } from "./Timeline";

interface Props {
  initial: Video;
  onChange: () => void;
  onOpenLibrary: () => void;
  onOpenKeys: () => void;
}

export function VideoView({ initial, onChange, onOpenLibrary, onOpenKeys }: Props) {
  const [video, setVideo] = useState<Video>(initial);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [sensitivity, setSensitivity] = useState(7);
  const [selection, setSelection] = useState<Roi | null>(null);
  const [filter, setFilter] = useState<Roi | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<ZoomView>(NO_ZOOM);
  const [clipIn, setClipIn] = useState<number | null>(null);
  const [clipOut, setClipOut] = useState<number | null>(null);
  const [enhanceAt, setEnhanceAt] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [exports, setExports] = useState<Job[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [stripTab, setStripTab] = useState<"momentos" | "favoritos">("momentos");
  const [toast, setToast] = useState<{ text: string; star: boolean } | null>(null);
  const [saveRange, setSaveRange] = useState<{ s: number; e: number } | null>(null);
  // modo "emendar momentos": ao fim de um momento, pula a parte parada e toca o próximo
  const [chain, setChain] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const threshold = THRESHOLDS[sensitivity - 1];

  const playable = Boolean(video.playable);
  const scanJob = video.jobs?.find((j) => j.kind === "motion_scan");
  const proxyJob = video.jobs?.find((j) => j.kind === "proxy");
  const searchState = video.analysis_status === "done" ? "done" : video.analysis_status === "error" ? "failed" : "searching";
  const ready = searchState === "done";
  const segments = motion?.segments ?? [];
  // lidos dentro do laço de reprodução, que não é recriado a cada render
  const chainRef = useRef(chain);
  chainRef.current = chain && ready;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  // acompanha a busca por movimentos e o preparo para tocar
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const v = await api.video(video.id).catch(() => null);
      if (stop || !v) return;
      setVideo(v);
      if (v.analysis_status !== video.analysis_status) onChange();
    };
    tick();
    if (searchState !== "searching" && playable) return;
    const id = setInterval(tick, 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [video.id, searchState, playable]); // eslint-disable-line react-hooks/exhaustive-deps

  // linha do tempo recalculada para o filtro e a sensibilidade atuais
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      api.motion(video.id, filter, threshold).then(setMotion).catch(() => setMotion(null));
    }, 100);
    return () => clearTimeout(id);
  }, [video.id, ready, filter, threshold]);

  useEffect(() => {
    api.favorites(video.id).then(setFavorites).catch(() => {});
  }, [video.id]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // trechos sendo salvos nesta sessão
  useEffect(() => {
    if (!exports.some((j) => j.status === "queued" || j.status === "running")) return;
    const id = setInterval(async () => {
      const fresh = await Promise.all(
        exports.map((j) => (j.status === "done" || j.status === "error" ? j : api.job(j.id).catch(() => j))),
      );
      setExports(fresh);
    }, 700);
    return () => clearInterval(id);
  }, [exports]);

  // cursor suave enquanto toca
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    // modo emendar: fora de um momento, salta para o início do próximo. Checado a cada
    // quadro e também no timeupdate, que continua disparando com a janela em segundo plano
    const followChain = () => {
      const segs = segmentsRef.current;
      if (!chainRef.current || v.paused || v.seeking || segs.length === 0) return;
      const t = v.currentTime;
      if (segs.some((s) => t >= s.start && t < s.end)) return;
      const i = segs.findIndex((s) => s.start > t);
      if (i >= 0) {
        v.currentTime = segs[i].start;
        setToast({ text: `Próximo momento · ${i + 1} de ${segs.length}`, star: false });
      } else {
        v.pause();
        setToast({ text: "Fim dos momentos com movimento", star: false });
      }
    };
    const loop = () => {
      followChain();
      setTime(v.currentTime);
      raf = requestAnimationFrame(loop);
    };
    const onPlay = () => {
      setPaused(false);
      raf = requestAnimationFrame(loop);
    };
    const onPause = () => {
      setPaused(true);
      cancelAnimationFrame(raf);
      setTime(v.currentTime);
    };
    const onSeeked = () => setTime(v.currentTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("timeupdate", followChain);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("timeupdate", followChain);
    };
  }, [playable]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, playable]);

  const seek = useCallback(
    (t: number) => {
      const c = Math.max(0, Math.min(video.duration, t));
      if (videoRef.current) videoRef.current.currentTime = c;
      setTime(c);
    },
    [video.duration],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const frameStep = useCallback(
    (dir: 1 | -1) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      seek(v.currentTime + dir / (video.fps || 15));
    },
    [seek, video.fps],
  );

  const jump = useCallback(
    (dir: 1 | -1) => {
      const t = videoRef.current?.currentTime ?? time;
      let target: Segment | undefined;
      if (dir > 0) {
        target = segments.find((s) => s.start > t + 0.05);
      } else {
        // P volta ao momento anterior ao atual (não reinicia o atual)
        const cur = segments.findIndex((s) => t >= s.start - 0.05 && t <= s.end);
        let prev = cur - 1;
        if (cur < 0) for (let i = 0; i < segments.length && segments[i].end < t; i++) prev = i;
        target = prev >= 0 ? segments[prev] : undefined;
      }
      if (target) seek(target.start);
    },
    [segments, seek, time],
  );

  const openEnhance = useCallback(() => {
    if (!selection) return;
    videoRef.current?.pause();
    setEnhanceAt(videoRef.current?.currentTime ?? time);
  }, [selection, time]);

  const applyFilter = useCallback(() => {
    if (selection && ready) setFilter(selection);
  }, [selection, ready]);

  const now = () => videoRef.current?.currentTime ?? time;

  // --- favoritos -------------------------------------------------------------
  const sameRange = (f: Favorite, s: number, e: number) => Math.abs(f.start - s) < 0.5 && Math.abs(f.end - e) < 0.5;
  const favoriteOf = (seg: Segment) => favorites.find((f) => sameRange(f, seg.start, seg.end));

  /** O que M / "Favoritar" guarda: o trecho marcado, senão o momento em reprodução, senão o ponto atual. */
  function favoriteTarget() {
    const t = now();
    if (clipIn !== null && clipOut !== null && clipOut > clipIn)
      return { start: clipIn, end: clipOut, label: "Trecho marcado", hint: "Favoritar o trecho marcado" };
    const seg = segments.find((s) => t >= s.start && t <= s.end);
    if (seg) return { start: seg.start, end: seg.end, label: "Momento", hint: "Favoritar este momento" };
    return { start: t, end: t, label: "Ponto", hint: "Favoritar este ponto do vídeo" };
  }

  async function addFavorite(start: number, end: number, label: string) {
    const f = await api.addFavorite(video.id, start, end).catch(() => null);
    if (!f) return setToast({ text: "Não foi possível guardar o favorito", star: false });
    setFavorites((list) => [...list, f].sort((a, b) => a.start - b.start));
    setToast({ text: `${label} guardado nos favoritos`, star: true });
  }

  async function removeFavorite(f: Favorite) {
    await api.removeFavorite(f.id).catch(() => null);
    setFavorites((list) => list.filter((x) => x.id !== f.id));
    setToast({ text: "Tirado dos favoritos", star: true });
  }

  function toggleFavoriteNow() {
    const target = favoriteTarget();
    const existing = favorites.find((f) => sameRange(f, target.start, target.end));
    if (existing) removeFavorite(existing);
    else addFavorite(target.start, target.end, target.label);
  }

  function toggleSegmentFavorite(seg: Segment) {
    const existing = favoriteOf(seg);
    if (existing) removeFavorite(existing);
    else addFavorite(seg.start, seg.end, "Momento");
  }

  async function renameFavorite(f: Favorite, name: string) {
    if (name.trim() === f.name) return;
    const updated = await api.updateFavorite(f.id, { name }).catch(() => null);
    if (updated) setFavorites((list) => list.map((x) => (x.id === f.id ? updated : x)));
  }

  function saveFavorite(f: Favorite) {
    // ponto favorito: abre com 5 s antes e depois
    const point = f.end - f.start < 0.05;
    setSaveRange(
      point
        ? { s: Math.max(0, f.start - 5), e: Math.min(video.duration, f.start + 5) }
        : { s: f.start, e: f.end },
    );
    setSaveOpen(true);
  }

  const target = favoriteTarget();
  const favoriteActive = favorites.some((f) => sameRange(f, target.start, target.end));

  // atalhos de teclado (DESIGN.md 10)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsBlocked(e)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const step = e.shiftKey ? 60 : 5;
      const actions: Record<string, () => void> = {
        " ": togglePlay,
        ArrowRight: () => seek(now() + step),
        ArrowLeft: () => seek(now() - step),
        ".": () => frameStep(1),
        ",": () => frameStep(-1),
        n: () => jump(1),
        p: () => jump(-1),
        i: () => setClipIn(now()),
        o: () => setClipOut(now()),
        s: () => setSelectMode((m) => !m),
        f: applyFilter,
        e: openEnhance,
        x: () => setSaveOpen(true),
        m: toggleFavoriteNow,
        a: () => ready && setChain((c) => !c),
        "[": () => setSensitivity((v) => Math.max(1, v - 1)),
        "]": () => setSensitivity((v) => Math.min(10, v + 1)),
        Home: () => seek(0),
        End: () => seek(video.duration - 0.1),
        "+": () => setSpeed((v) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(v) + 1)]),
        "=": () => setSpeed((v) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(v) + 1)]),
        "-": () => setSpeed((v) => SPEEDS[Math.max(0, SPEEDS.indexOf(v) - 1)]),
        Escape: () => {
          if (selectMode) setSelectMode(false);
          else setSelection(null);
        },
      };
      const fn = actions[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function retry() {
    await api.reanalyze(video.id).catch(() => null);
    setVideo((v) => ({ ...v, analysis_status: "queued" }));
    onChange();
  }

  async function saveStart(value: string | null) {
    const v = await api.setStartTime(video.id, value);
    setVideo((old) => ({ ...old, ...v }));
    onChange();
  }

  // contador "Movimento 37 de 128"
  const tNow = time;
  const activeIndex = segments.findIndex((s) => tNow >= s.start && tNow <= s.end);
  let passed = -1;
  for (let i = 0; i < segments.length && segments[i].start <= tNow + 0.25; i++) passed = i;
  const counter =
    searchState === "searching"
      ? "Pular entre movimentos: disponível ao terminar a busca"
      : searchState === "failed"
        ? "Sem movimentos para pular"
        : segments.length === 0
          ? "Nenhum movimento"
          : passed >= 0
            ? `Movimento ${passed + 1} de ${segments.length.toLocaleString("pt-BR")}`
            : `${segments.length.toLocaleString("pt-BR")} movimentos`;

  const saveDefaults = () => {
    if (saveRange) return saveRange;
    const s = clipIn ?? now();
    let e = clipOut ?? Math.min(video.duration, s + 30);
    if (e <= s) e = Math.min(video.duration, s + 30);
    return { s, e };
  };
  const saving = exports.filter((j) => j.status === "queued" || j.status === "running").length;
  const ext = video.name.split(".").pop()?.toLowerCase();
  const contentAspect = video.width / video.height || 16 / 9;

  return (
    <div className="page">
      <Header
        video={video}
        status={searchState}
        searchProgress={scanJob?.progress ?? 0}
        sensitivity={sensitivity}
        onSensitivity={setSensitivity}
        onOpenLibrary={onOpenLibrary}
        onOpenSave={() => setSaveOpen(true)}
        savingCount={saving}
      />

      <Stage
        src={playable ? api.streamUrl(video.id) : null}
        videoWidth={video.width}
        videoHeight={video.height}
        videoRef={videoRef}
        selectMode={selectMode}
        selection={selection}
        filter={filter}
        view={view}
        onView={setView}
        onSelection={(r) => {
          setSelection(r);
          setSelectMode(false);
        }}
        onTogglePlay={togglePlay}
      >
        {!playable && (
          <div className="stage-placeholder preparing">
            <IconCamera size={40} />
            <span className="title">Preparando o vídeo para tocar… {Math.round((proxyJob?.progress ?? 0) * 100)}%</span>
            <span className="progress light" style={{ width: 360, maxWidth: "80%", height: 6 }}>
              <span style={{ width: `${(proxyJob?.progress ?? 0) * 100}%` }} />
            </span>
            <span className="body" style={{ fontSize: 13 }}>
              Este formato (.{ext}) precisa ser convertido antes de tocar no navegador. O arquivo original não é alterado. A
              busca por movimentos já começou ao mesmo tempo.
            </span>
          </div>
        )}

        {playable && <SceneClock video={video} time={time} onSave={saveStart} />}

        {playable && (
          <AreaTools
            selecting={selectMode}
            hasSelection={Boolean(selection)}
            hasFilter={Boolean(filter)}
            searchDone={ready}
            onToggleSelect={() => setSelectMode(!selectMode)}
            onFilter={applyFilter}
            onEnhance={openEnhance}
            onClearSelection={() => setSelection(null)}
            onRemoveFilter={() => setFilter(null)}
          />
        )}

        {selectMode && (
          <>
            <div className="dim" />
            <span className="pill amber" role="status">
              <span style={{ display: "flex" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                </svg>
              </span>
              Clique e arraste para desenhar um retângulo · Esc cancela
            </span>
            <span className="stage-hint">
              Ao soltar o mouse, a nova seleção substitui a anterior. Enquanto desenha, clicar não pausa o vídeo.
            </span>
          </>
        )}

        {view.s > 1 && !selectMode && (
          <>
            <span className="pill neutral" role="status">
              Zoom <strong className="mono">{view.s.toFixed(1)}x</strong> · arraste para mover · clique duas vezes para voltar
              ao normal
            </span>
            <Minimap videoRef={videoRef} view={view} contentAspect={contentAspect} />
          </>
        )}

        {toast && (
          <span className={`toast ${toast.star ? "" : "info"}`} role="status">
            {toast.star && <IconStar size={14} filled />}
            {toast.text}
          </span>
        )}

        <BottomBar
          timeline={
            motion && (
              <Timeline
                videoId={video.id}
                duration={video.duration}
                motion={motion}
                threshold={threshold}
                time={time}
                startTime={video.start_time}
                clipIn={clipIn}
                clipOut={clipOut}
                favorites={favorites}
                onSeek={seek}
              />
            )
          }
          searchState={searchState}
          searchProgress={scanJob?.progress ?? 0}
          failureDetail={scanJob?.message ?? null}
          onRetry={retry}
          playable={playable}
          paused={paused}
          counter={counter}
          zoom={view.s}
          speed={speed}
          onSpeed={setSpeed}
          chain={chain}
          onChain={() => setChain((c) => !c)}
          favoriteActive={favoriteActive}
          favoriteHint={favoriteActive ? "Tirar dos favoritos" : target.hint}
          onFavorite={toggleFavoriteNow}
          startTime={video.start_time}
          clipIn={clipIn}
          clipOut={clipOut}
          onTogglePlay={togglePlay}
          onFrame={frameStep}
          onJump={jump}
          onMarkIn={() => setClipIn(now())}
          onMarkOut={() => setClipOut(now())}
        />
      </Stage>

      <ShortcutLegend onOpenAll={onOpenKeys} />

      <Moments
        videoId={video.id}
        searchState={searchState}
        segments={segments}
        filtered={Boolean(filter)}
        activeIndex={activeIndex}
        startTime={video.start_time}
        time={time}
        favorites={favorites}
        favoriteOf={favoriteOf}
        onToggleFavorite={toggleSegmentFavorite}
        onRenameFavorite={renameFavorite}
        onRemoveFavorite={removeFavorite}
        onSaveFavorite={saveFavorite}
        tab={stripTab}
        onTab={setStripTab}
        onSeek={seek}
      />

      {enhanceAt !== null && selection && (
        <EnhanceDialog video={video} t={enhanceAt} roi={selection} onClose={() => setEnhanceAt(null)} />
      )}

      {saveOpen && (
        <SaveDialog
          video={video}
          start={saveDefaults().s}
          end={saveDefaults().e}
          selection={selection}
          filter={filter}
          threshold={threshold}
          jobs={exports}
          onRange={(s, e) => {
            setClipIn(s);
            setClipOut(e);
          }}
          onJob={(j) => setExports((list) => [j, ...list])}
          onClose={() => {
            setSaveOpen(false);
            setSaveRange(null);
          }}
        />
      )}
    </div>
  );
}
