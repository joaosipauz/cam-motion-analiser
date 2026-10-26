import { useEffect, useRef, useState } from "react";
import { api, ApiError, Library, Video } from "../api";
import { fmtSize, videoSummary } from "../format";
import { IconChevronLeft, IconClose, IconFile, IconFolder, IconFolderMissing, IconTrash } from "../icons";
import { FolderPicker } from "./FolderPicker";
import { useFocusTrap } from "./Modal";

export type LibraryTab = "pasta" | "abertos";

interface Props {
  tab: LibraryTab;
  onTab: (t: LibraryTab) => void;
  currentId: string | null;
  videos: Video[];
  opening: string | null;
  fileErrors: Record<string, string>;
  onOpenFile: (path: string) => void;
  onSelect: (v: Video) => void;
  onRemove: (v: Video) => Promise<void>;
  onClose: () => void;
}

const STATUS: Record<Video["analysis_status"], [string, string]> = {
  done: ["pronto", "var(--filter-text)"],
  running: ["procurando movimentos", "var(--selection-text)"],
  queued: ["aguardando a vez", "var(--text-2)"],
  pending: ["aguardando a vez", "var(--text-2)"],
  error: ["deu erro", "var(--danger-icon)"],
};

/** Gaveta "Seus vídeos" (DESIGN.md 4.10). */
export function LibraryDrawer(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, p.onClose);

  return (
    <div className="drawer-wrap">
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Biblioteca de vídeos">
        <div className="drawer-head">
          <h2>Seus vídeos</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={p.onClose}>
            <IconClose />
          </button>
        </div>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={p.tab === "pasta"} onClick={() => p.onTab("pasta")}>
            Na pasta
          </button>
          <button role="tab" aria-selected={p.tab === "abertos"} onClick={() => p.onTab("abertos")}>
            Já abertos · {p.videos.length}
          </button>
        </div>
        {p.tab === "pasta" ? <FolderTab {...p} /> : <OpenedTab {...p} />}
      </div>
      <button className="drawer-scrim" aria-label="Fechar" tabIndex={-1} onClick={p.onClose} />
    </div>
  );
}

// a gaveta reabre na última pasta visitada
let lastPath = "";

function FolderTab({ currentId, opening, fileErrors, onOpenFile }: Props) {
  const [lib, setLib] = useState<Library | null>(null);
  const [path, setPathState] = useState(lastPath);
  const setPath = (p: string) => {
    lastPath = p;
    setPathState(p);
  };
  const [missing, setMissing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);

  function load(p: string) {
    setLoading(true);
    api
      .library(p)
      .then((l) => {
        setLib(l);
        setPath(l.path);
        setMissing(null);
      })
      .catch((e) => {
        // pasta de um disco desconectado, movida ou tirada da lista
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setMissing(p);
        else setMissing("");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => load(path), [opening]); // eslint-disable-line react-hooks/exhaustive-deps

  async function removeFolder(id: number) {
    await api.removeFolder(id).catch(() => null);
    load("");
  }

  if (picking) {
    return (
      <FolderPicker
        onCancel={() => setPicking(false)}
        onAdded={() => {
          setPicking(false);
          load("");
        }}
      />
    );
  }

  if (missing !== null) {
    return (
      <div className="drawer-state" role="alert">
        <span style={{ color: "var(--danger-icon)" }}>
          <IconFolderMissing size={40} />
        </span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Não encontramos a pasta de vídeos</span>
        {missing && <span className="path">{missing}</span>}
        <span className="t2" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Ela pode ter sido movida, renomeada ou estar num disco desconectado. Reconecte o disco e tente de novo, ou escolha
          outra pasta.
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" onClick={() => load("")}>
            Ver suas pastas
          </button>
          <button className="btn primary" onClick={() => load(path)}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!lib) return <div className="drawer-state t2">{loading ? "Carregando…" : ""}</div>;

  // nível de cima: as pastas cadastradas
  if (lib.roots) {
    return (
      <>
        <div className="lib-list" style={{ paddingTop: 8 }}>
          {lib.roots.length === 0 && (
            <div className="drawer-state" style={{ flex: "none", padding: "24px 12px" }}>
              <span className="t3">
                <IconFolder size={36} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma pasta de vídeos ainda</span>
              <span className="t2" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Escolha a pasta onde ficam as gravações das câmeras. Você pode adicionar quantas quiser.
              </span>
            </div>
          )}
          {lib.roots.map((f) => (
            <div key={f.id} className="opened-row" style={{ padding: "4px 4px 4px 0" }}>
              <button className="lib-item folder" style={{ flex: 1, minWidth: 0 }} onClick={() => load(f.path)} disabled={!f.exists}>
                <IconFolder />
                <span className="texts">
                  <span>{f.name}</span>
                  <span className="meta mono" title={f.path} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.path}
                  </span>
                </span>
                {!f.exists && (
                  <span className="tag" style={{ color: "var(--danger-icon)" }}>
                    não encontrada
                  </span>
                )}
              </button>
              <button
                className="icon-btn"
                style={{ width: 36, height: 36 }}
                aria-label={`Tirar ${f.name} da lista`}
                title="Tirar da lista (nenhum arquivo é apagado)"
                onClick={() => removeFolder(f.id)}
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
          <button className="btn primary" style={{ margin: "8px 4px 0" }} onClick={() => setPicking(true)}>
            <IconFolder />
            Adicionar pasta de vídeos
          </button>
        </div>
        <div className="drawer-foot">
          O app só lê os arquivos destas pastas: nunca altera nem apaga os originais. Tirar uma pasta da lista não apaga nada.
        </div>
      </>
    );
  }

  // dentro de uma pasta cadastrada
  const rel = lib.root && lib.path.startsWith(lib.root.path) ? lib.path.slice(lib.root.path.length) : "";
  const crumbs = `${lib.root?.name ?? ""}${rel.replace(/[\\/]+/g, " / ")}`;
  const parentName = lib.parent ? lib.parent.split(/[\\/]/).filter(Boolean).pop() : "suas pastas";
  return (
    <>
      <div className="crumbs" title={lib.path}>
        {crumbs}
      </div>
      <div className="lib-list">
        <button className="lib-item back" onClick={() => load(lib.parent ?? "")}>
          <IconChevronLeft />
          Voltar para {parentName}
        </button>
        {lib.dirs.map((d) => (
          <button key={d.path} className="lib-item folder" onClick={() => load(d.path)}>
            <IconFolder />
            {d.name}
          </button>
        ))}
        {lib.files.map((f) => {
          const err = fileErrors[f.path];
          const isCurrent = Boolean(f.video_id) && f.video_id === currentId;
          const [tag, color] =
            opening === f.path
              ? ["abrindo…", "var(--selection-text)"]
              : err
                ? ["não abriu", "var(--danger-icon)"]
                : isCurrent
                  ? ["aberto agora", "var(--text)"]
                  : f.video_id
                    ? ["já analisado", "var(--filter-text)"]
                    : ["", ""];
          return (
            <div key={f.path}>
              <button
                className={`lib-item ${isCurrent ? "current" : ""}`}
                disabled={opening !== null && opening !== f.path}
                onClick={() => onOpenFile(f.path)}
              >
                <IconFile />
                <span className="texts">
                  <span className="fname" title={f.name}>
                    {f.name}
                  </span>
                  <span className="meta">{fmtSize(f.size)}</span>
                </span>
                {tag && (
                  <span className="tag" style={{ color }}>
                    {tag}
                  </span>
                )}
              </button>
              {err && (
                <div className="lib-error" role="alert">
                  <span>Este vídeo não abriu. O arquivo pode estar incompleto (download interrompido) ou corrompido.</span>
                  <span className="tech">Detalhe técnico: {err}</span>
                </div>
              )}
            </div>
          );
        })}
        {lib.dirs.length + lib.files.length === 0 && (
          <div className="t2" style={{ padding: "12px 10px", fontSize: 13 }}>
            Esta pasta não tem vídeos.
          </div>
        )}
      </div>
      <div className="drawer-foot">
        Clique num vídeo para abrir. O app só lê os arquivos: nunca altera nem apaga os originais. Aceita mp4, mkv, avi, mov,
        ts, m4v, dav, h264 e h265.
      </div>
    </>
  );
}

function OpenedTab({ videos, currentId, onSelect, onRemove }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null);

  if (videos.length === 0) {
    return (
      <div className="t2" style={{ padding: "16px 18px", fontSize: 13 }}>
        Nenhum vídeo aberto ainda.
      </div>
    );
  }
  return (
    <div className="lib-list" style={{ paddingTop: 8 }}>
      {videos.map((v) => {
        const [label, color] = STATUS[v.analysis_status] ?? STATUS.queued;
        return (
          <div key={v.id}>
            <div className={`opened-row ${v.id === currentId ? "current" : ""}`}>
              <button className="open" onClick={() => onSelect(v)} title={v.path}>
                <span className="lib-item" style={{ padding: 0, minHeight: 0 }}>
                  <span className="texts">
                    <span className="fname">{v.name}</span>
                    <span className="meta">{videoSummary(v)}</span>
                  </span>
                </span>
              </button>
              <span className="status-pill" style={{ color }}>
                {label}
              </span>
              <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Remover ${v.name} do app`} title="Remover do app" onClick={() => setConfirm(v.id)}>
                <IconTrash />
              </button>
            </div>
            {confirm === v.id && (
              <div className="confirm" role="alertdialog" aria-label="Confirmar remoção">
                <span>
                  Remover <span className="mono">{v.name}</span> do app?
                </span>
                <span className="why">
                  Apaga só o que o app guardou (a busca por movimentos). O vídeo original continua na pasta e pode ser aberto de
                  novo quando quiser.
                </span>
                <div className="actions">
                  <button className="btn ghost sm" autoFocus onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                  <button
                    className="btn danger sm"
                    onClick={async () => {
                      await onRemove(v);
                      setConfirm(null);
                    }}
                  >
                    Remover do app
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
