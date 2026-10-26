export type Roi = [number, number, number, number]; // x, y, w, h normalizados (0..1)

export interface Video {
  id: string;
  path: string;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  start_time: string | null;
  start_time_source: "arquivo" | "metadados" | "manual" | null;
  playable: number;
  proxy_path: string | null;
  analysis_status: "pending" | "queued" | "running" | "done" | "error";
  jobs?: Job[];
}

export interface Job {
  id: number;
  kind: "motion_scan" | "proxy" | "export_clip";
  video_id: string;
  params: Record<string, unknown>;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  message: string | null;
  result: Record<string, unknown> | null;
}

export interface LibraryEntry {
  name: string;
  path: string;
  size?: number;
  video_id?: string | null;
}

export interface Folder {
  id: number;
  path: string;
  name: string;
  exists: boolean;
}

/** Sem `path`: `roots` traz as pastas cadastradas. Com `path`: conteúdo dentro de `root`. */
export interface Library {
  path: string;
  parent: string | null;
  root: { id: number; path: string; name: string } | null;
  roots: Folder[] | null;
  dirs: LibraryEntry[];
  files: LibraryEntry[];
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  places: { name: string; path: string }[];
  dirs: { name: string; path: string }[];
  videos: number;
}

export interface Segment {
  start: number;
  end: number;
  peak: number;
}

export interface Motion {
  duration: number;
  bins: number[];
  segments: Segment[];
}

/** Trecho favorito; um ponto quando start === end. */
export interface Favorite {
  id: number;
  video_id: string;
  start: number;
  end: number;
  name: string;
}

export type AiModel = "ia" | "ia_forte" | "swinir";
export type EnhanceMode = "fiel" | "bicubic" | AiModel;
export type ExportMode = "fast" | "precise" | "enhanced";

export interface FrameCandidate {
  t: number;
  sharpness: number; // relativa ao mais nítido da janela (0..1)
  current: boolean;
}

/** Erro da API: `status` HTTP e `detail` cru do servidor (vai para "Detalhe técnico"). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

async function check(res: Response) {
  if (res.ok) return res;
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
  } catch {
    /* resposta sem json */
  }
  throw new ApiError(res.status, detail);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await check(res)).json();
}

const roiParam = (roi: Roi | null | undefined) => (roi ? `&roi=${roi.join(",")}` : "");

export const api = {
  config: () => request<{ media_dir: string }>("GET", "/config"),
  library: (path = "") => request<Library>("GET", `/library?path=${encodeURIComponent(path)}`),
  addFolder: (path: string) => request<Folder>("POST", "/folders", { path }),
  removeFolder: (id: number) => request("DELETE", `/folders/${id}`),
  browse: (path = "") => request<BrowseResult>("GET", `/browse?path=${encodeURIComponent(path)}`),
  videos: () => request<Video[]>("GET", "/videos"),
  video: (id: string) => request<Video>("GET", `/videos/${id}`),
  register: (path: string) => request<Video>("POST", "/videos", { path }),
  remove: (id: string) => request("DELETE", `/videos/${id}`),
  reanalyze: (id: string) => request<{ job_id: number }>("POST", `/videos/${id}/analyze`),
  setStartTime: (id: string, start_time: string | null) =>
    request<Video>("PATCH", `/videos/${id}`, { start_time }),
  motion: (id: string, roi: Roi | null, threshold: number, bins = 2000) =>
    request<Motion>("GET", `/videos/${id}/motion?threshold=${threshold}&bins=${bins}${roiParam(roi)}`),
  motionRange: (id: string, roi: Roi | null, start: number, end: number, bins = 80) =>
    request<Motion>(
      "GET",
      `/videos/${id}/motion?bins=${bins}&start=${start.toFixed(3)}&end=${end.toFixed(3)}${roiParam(roi)}`,
    ),
  keyframe: (id: string, t: number) => request<{ t: number }>("GET", `/videos/${id}/keyframe?t=${t.toFixed(3)}`),
  exportClip: (
    id: string,
    body: { start: number; end: number; mode: ExportMode; roi: Roi | null; model: AiModel },
  ) => request<{ job_id: number }>("POST", `/videos/${id}/export`, body),
  sharpest: (id: string, t: number, roi: Roi) =>
    request<FrameCandidate[]>("GET", `/videos/${id}/sharpest?t=${t.toFixed(3)}&roi=${roi.join(",")}`),
  job: (id: number) => request<Job>("GET", `/jobs/${id}`),
  favorites: (id: string) => request<Favorite[]>("GET", `/videos/${id}/favorites`),
  addFavorite: (id: string, start: number, end: number, name = "") =>
    request<Favorite>("POST", `/videos/${id}/favorites`, { start, end, name }),
  updateFavorite: (favId: number, fields: Partial<Pick<Favorite, "start" | "end" | "name">>) =>
    request<Favorite>("PATCH", `/favorites/${favId}`, fields),
  removeFavorite: (favId: number) => request("DELETE", `/favorites/${favId}`),
  async enhance(id: string, t: number, roi: Roi, mode: EnhanceMode) {
    const res = await fetch(`/api/videos/${id}/enhance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t, roi, mode }),
    });
    return (await check(res)).blob();
  },
  streamUrl: (id: string) => `/api/videos/${id}/stream`,
  frameUrl: (id: string, t: number, width = 240, roi?: Roi) =>
    `/api/videos/${id}/frame?t=${t.toFixed(3)}&width=${width}${roiParam(roi)}`,
  exportUrl: (name: string) => `/api/exports/${encodeURIComponent(name)}`,
};
