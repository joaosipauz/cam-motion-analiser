import { useEffect, useState } from "react";
import { api, ApiError, BrowseResult } from "../api";
import { IconChevronLeft, IconFolder } from "../icons";

interface Props {
  onAdded: () => void;
  onCancel: () => void;
}

/** Escolher uma pasta do computador para o app procurar vídeos. */
export function FolderPicker({ onAdded, onCancel }: Props) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<{ text: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function go(path: string) {
    setError(null);
    api
      .browse(path)
      .then(setData)
      .catch((e) =>
        setError({ text: "Não foi possível abrir esta pasta.", detail: e instanceof ApiError ? e.detail : String(e) }),
      );
  }

  useEffect(() => go(""), []);

  async function add(path: string) {
    setBusy(true);
    setError(null);
    try {
      await api.addFolder(path);
      onAdded();
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : String(e);
      setError({
        text: /nao encontrada/i.test(detail)
          ? "Não encontramos essa pasta. Confira o caminho ou escolha na lista."
          : "Não foi possível adicionar a pasta.",
        detail,
      });
    } finally {
      setBusy(false);
    }
  }

  const atPlaces = data !== null && data.path === "";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "12px 18px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Escolha a pasta com os vídeos</span>
        <span className="t3" style={{ fontSize: 12, lineHeight: 1.45 }}>
          O app só lê os arquivos dessa pasta e das subpastas. Nada é alterado nem apagado.
        </span>
      </div>

      <form
        style={{ display: "flex", gap: 6, padding: "8px 12px" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) add(typed);
        }}
      >
        <label htmlFor="folder-path" className="sr-only">
          Caminho da pasta
        </label>
        <input
          id="folder-path"
          className="field"
          style={{ flex: 1, minWidth: 0 }}
          placeholder="Ou cole o caminho, ex.: D:\Gravacoes"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!typed.trim() || busy}>
          Adicionar
        </button>
      </form>

      {error && (
        <div className="lib-error" role="alert" style={{ margin: "0 12px 8px" }}>
          <span>{error.text}</span>
          <span className="tech">Detalhe técnico: {error.detail}</span>
        </div>
      )}

      {data && !atPlaces && <div className="crumbs">{data.path}</div>}

      <div className="lib-list">
        {data === null && <span className="t2" style={{ padding: 10, fontSize: 13 }}>Carregando…</span>}
        {atPlaces &&
          data.places.map((p) => (
            <button key={p.path} className="lib-item folder" onClick={() => go(p.path)}>
              <IconFolder />
              <span className="texts">
                <span>{p.name}</span>
                <span className="meta mono">{p.path}</span>
              </span>
            </button>
          ))}
        {data && !atPlaces && (
          <>
            <button className="lib-item back" onClick={() => go(data.parent ?? "")}>
              <IconChevronLeft />
              {data.parent ? "Voltar uma pasta" : "Voltar para os atalhos"}
            </button>
            {data.dirs.map((d) => (
              <button key={d.path} className="lib-item folder" onClick={() => go(d.path)}>
                <IconFolder />
                {d.name}
              </button>
            ))}
            {data.dirs.length === 0 && (
              <span className="t3" style={{ padding: "8px 10px", fontSize: 12 }}>
                Sem subpastas.
              </span>
            )}
          </>
        )}
      </div>

      <div className="drawer-foot" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data && !atPlaces && (
          <span>
            {data.videos === 0
              ? "Nenhum vídeo diretamente nesta pasta (pode haver nas subpastas)."
              : `${data.videos.toLocaleString("pt-BR")} ${data.videos === 1 ? "vídeo" : "vídeos"} nesta pasta.`}
          </span>
        )}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!data || atPlaces || busy} onClick={() => data && add(data.path)}>
            Usar esta pasta
          </button>
        </div>
      </div>
    </div>
  );
}
