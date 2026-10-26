import { useEffect, useRef, useState } from "react";
import { api, Favorite, Segment } from "../api";
import { fmtClock, fmtPercent, shortDuration } from "../format";
import { IconDownload, IconPencil, IconStar, IconTrash } from "../icons";

interface Props {
  videoId: string;
  searchState: "searching" | "done" | "failed";
  segments: Segment[];
  filtered: boolean;
  activeIndex: number;
  startTime: string | null;
  time: number;
  favorites: Favorite[];
  favoriteOf: (s: Segment) => Favorite | undefined;
  onToggleFavorite: (s: Segment) => void;
  onRenameFavorite: (f: Favorite, name: string) => void;
  onRemoveFavorite: (f: Favorite) => void;
  onSaveFavorite: (f: Favorite) => void;
  onSeek: (t: number) => void;
  tab: "momentos" | "favoritos";
  onTab: (t: "momentos" | "favoritos") => void;
}

const PAGE = 100;

/** Faixa abaixo do vídeo: "Momentos com movimento" e "Favoritos" (DESIGN.md 4.9). */
export function Moments(p: Props) {
  const count = p.segments.length;
  return (
    <section className="moments" aria-label="Momentos e favoritos">
      <div className="head">
        <div className="section-tabs" role="tablist">
          <button role="tab" aria-selected={p.tab === "momentos"} onClick={() => p.onTab("momentos")}>
            Momentos com movimento{" "}
            <span className="count">
              {p.searchState === "done"
                ? `· ${count.toLocaleString("pt-BR")} ${count === 1 ? "encontrado" : "encontrados"}${p.filtered ? " dentro do filtro" : ""}`
                : p.searchState === "searching"
                  ? "· aparecem aqui quando a busca terminar"
                  : ""}
            </span>
          </button>
          <button role="tab" aria-selected={p.tab === "favoritos"} onClick={() => p.onTab("favoritos")}>
            Favoritos <span className="count">· {p.favorites.length}</span>
          </button>
        </div>
        {p.tab === "momentos" && count > 0 && (
          <span className="t3" style={{ fontSize: 12 }}>
            Clique em um momento para ir até ele · ☆ guarda nos favoritos
          </span>
        )}
      </div>
      {p.tab === "momentos" ? <MomentList {...p} /> : <FavoriteList {...p} />}
    </section>
  );
}

function MomentList({ videoId, searchState, segments, filtered, activeIndex, startTime, favoriteOf, onToggleFavorite, onSeek }: Props) {
  const [shown, setShown] = useState(PAGE);
  const active = useRef<HTMLButtonElement>(null);

  useEffect(() => setShown(PAGE), [segments]);

  // mantém o momento em reprodução visível na faixa
  useEffect(() => {
    if (activeIndex >= shown) setShown(Math.ceil((activeIndex + 1) / PAGE) * PAGE);
    active.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (searchState === "failed") {
    return (
      <span className="t2" style={{ fontSize: 13 }}>
        Nenhum momento disponível porque a busca não terminou.
      </span>
    );
  }
  if (searchState === "searching") {
    return (
      <div className="strip" style={{ overflow: "hidden" }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="moment skeleton" />
        ))}
      </div>
    );
  }
  if (segments.length === 0) {
    return (
      <span className="t2" style={{ fontSize: 13 }}>
        Nenhum movimento encontrado com essa sensibilidade. Tente aumentar a sensibilidade{filtered ? " ou remover o filtro" : ""}.
      </span>
    );
  }
  return (
    <div className="strip">
      {segments.slice(0, shown).map((s, i) => {
        const fav = favoriteOf(s);
        return (
          <div key={s.start} className="moment-wrap">
            <button
              ref={i === activeIndex ? active : undefined}
              className="moment"
              aria-current={i === activeIndex}
              onClick={() => onSeek(s.start)}
            >
              <span className="thumb">
                <img loading="lazy" src={api.frameUrl(videoId, s.start + Math.min(1.5, (s.end - s.start) / 2), 200)} alt="" />
                <span className="dur">dura {shortDuration(s.end - s.start)}</span>
              </span>
              <span className="line">
                <span className="time">{fmtClock(startTime, s.start)}</span>
                <span className="pct" title="Quanto da imagem se mexeu no pico">
                  {fmtPercent(s.peak)} da imagem
                </span>
              </span>
              <span className="bar">
                <span style={{ width: `${Math.min(100, s.peak * 100 * 11)}%` }} />
              </span>
            </button>
            <button
              className="star-btn"
              aria-pressed={Boolean(fav)}
              aria-label={fav ? "Tirar dos favoritos" : "Guardar nos favoritos"}
              title={fav ? "Tirar dos favoritos" : "Guardar nos favoritos"}
              onClick={() => onToggleFavorite(s)}
            >
              <IconStar filled={Boolean(fav)} />
            </button>
          </div>
        );
      })}
      {segments.length > shown && (
        <button className="moment more" onClick={() => setShown(shown + PAGE)}>
          Mostrar mais ({(segments.length - shown).toLocaleString("pt-BR")})
        </button>
      )}
    </div>
  );
}

function FavoriteList({ videoId, favorites, startTime, time, onSeek, onRenameFavorite, onRemoveFavorite, onSaveFavorite }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const editingRef = useRef<number | null>(null);
  editingRef.current = editing;

  // Enter e sair do campo salvam; o ref evita salvar duas vezes
  function commit(f: Favorite, name: string) {
    if (editingRef.current !== f.id) return;
    editingRef.current = null;
    setEditing(null);
    onRenameFavorite(f, name);
  }

  if (favorites.length === 0) {
    return (
      <span className="t2" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Nenhum favorito ainda. Use <kbd>M</kbd> ou o botão “Favoritar” para guardar o trecho marcado, o momento em reprodução ou
        o ponto atual. Nos momentos com movimento, clique na ☆.
      </span>
    );
  }
  return (
    <div className="strip">
      {favorites.map((f) => {
        const point = f.end - f.start < 0.05;
        const current = time >= f.start - 0.05 && time <= Math.max(f.end, f.start + 1);
        return (
          <div key={f.id} className="fav-card" aria-current={current}>
            <button className="open" onClick={() => onSeek(f.start)} title="Ir até o trecho">
              <span className="fav-body">
                <span className="thumb">
                  <img loading="lazy" src={api.frameUrl(videoId, point ? f.start : f.start + Math.min(1, (f.end - f.start) / 2), 220)} alt="" />
                  <span className="dur">{point ? "ponto" : `dura ${shortDuration(f.end - f.start)}`}</span>
                </span>
                <span className="time">
                  {fmtClock(startTime, f.start)}
                  {!point && ` – ${fmtClock(startTime, f.end)}`}
                </span>
              </span>
            </button>
            <div className="name-row">
              {editing === f.id ? (
                <input
                  className="field"
                  autoFocus
                  defaultValue={f.name}
                  placeholder="Nome do favorito"
                  aria-label="Nome do favorito"
                  maxLength={200}
                  onBlur={(e) => commit(f, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(f, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <>
                  <span className={`name ${f.name ? "" : "empty t3"}`} style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>
                    {f.name || "Sem nome"}
                  </span>
                  <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Dar nome" title="Dar nome" onClick={() => setEditing(f.id)}>
                    <IconPencil />
                  </button>
                </>
              )}
            </div>
            <div className="fav-actions">
              <button onClick={() => onSaveFavorite(f)} title="Abrir “Salvar trecho” com este favorito">
                <IconDownload size={14} />
                Salvar
              </button>
              <button onClick={() => onRemoveFavorite(f)} title="Tirar dos favoritos (o vídeo não é alterado)">
                <IconTrash size={14} />
                Tirar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
