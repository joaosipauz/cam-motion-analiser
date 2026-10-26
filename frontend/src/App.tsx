import { useCallback, useEffect, useState } from "react";
import { api, ApiError, Video } from "./api";
import { Header } from "./components/Header";
import { LibraryDrawer, LibraryTab } from "./components/LibraryDrawer";
import { ShortcutsDialog } from "./components/Shortcuts";
import { VideoView } from "./components/VideoView";
import { IconFolder } from "./icons";
import { shortcutsBlocked } from "./shortcuts";

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [current, setCurrent] = useState<Video | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("pasta");
  const [keysOpen, setKeysOpen] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    api.videos().then(setVideos).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  // B e ? valem em qualquer tela
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcutsBlocked(e)) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setLibraryOpen(true);
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setKeysOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openFile(path: string) {
    setOpening(path);
    setFileErrors(({ [path]: _, ...rest }) => rest);
    try {
      const v = await api.register(path);
      setCurrent(v);
      setLibraryOpen(false);
      refresh();
    } catch (e) {
      setFileErrors((errs) => ({ ...errs, [path]: e instanceof ApiError ? e.detail : String(e) }));
    } finally {
      setOpening(null);
    }
  }

  async function remove(v: Video) {
    await api.remove(v.id);
    if (current?.id === v.id) setCurrent(null);
    refresh();
  }

  return (
    <>
      {current ? (
        <VideoView
          key={current.id}
          initial={current}
          onChange={refresh}
          onOpenLibrary={() => setLibraryOpen(true)}
          onOpenKeys={() => setKeysOpen(true)}
        />
      ) : (
        <div className="page">
          <Header
            video={null}
            status={null}
            searchProgress={0}
            sensitivity={7}
            onSensitivity={() => {}}
            onOpenLibrary={() => setLibraryOpen(true)}
            savingCount={0}
          />
          <div className="stage">
            <div className="stage-placeholder empty">
              <IconFolder size={44} />
              <span className="title">Escolha um vídeo para começar</span>
              <span className="body">
                Assim que o vídeo abrir, o app procura sozinho os momentos com movimento. Tudo acontece no seu computador: nada
                é enviado para a internet.
              </span>
              <button className="btn primary" style={{ height: 44, fontSize: 14, padding: "0 18px" }} onClick={() => setLibraryOpen(true)}>
                Abrir pasta de vídeos
              </button>
            </div>
          </div>
        </div>
      )}

      {libraryOpen && (
        <LibraryDrawer
          tab={libraryTab}
          onTab={setLibraryTab}
          currentId={current?.id ?? null}
          videos={videos}
          opening={opening}
          fileErrors={fileErrors}
          onOpenFile={openFile}
          onSelect={(v) => {
            setCurrent(v);
            setLibraryOpen(false);
          }}
          onRemove={remove}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {keysOpen && <ShortcutsDialog onClose={() => setKeysOpen(false)} />}
    </>
  );
}
