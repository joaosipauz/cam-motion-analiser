/** Formatação em linguagem do dia a dia (DESIGN.md, seção 9). */
import { Video } from "./api";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function wallDate(startTime: string, t: number) {
  return new Date(new Date(startTime).getTime() + t * 1000);
}

/** HH:MM:SS do relógio, ou tempo decorrido quando o início é desconhecido. */
export function fmtClock(startTime: string | null, t: number) {
  if (!startTime) return fmtElapsed(t);
  const d = wallDate(startTime, t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** "seg, 26 out 2026" */
export function fmtDay(startTime: string, t: number) {
  const d = wallDate(startTime, t);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "26/10/2026 14:32:06.82" (centésimos, para o quadro exato). */
export function fmtStamp(startTime: string | null, t: number) {
  if (!startTime) return `${fmtElapsed(t)}.${pad(Math.floor((t % 1) * 100))}`;
  const d = wallDate(startTime, t);
  const cs = pad(Math.floor((d.getMilliseconds() / 10) % 100));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${fmtClock(startTime, t)}.${cs}`;
}

/** Duração longa: "12 horas", "6 h 30 min", "4 minutos", "40 segundos". */
export function humanDuration(s: number) {
  if (s < 60) return `${Math.round(s)} segundos`;
  if (s < 3600) {
    const m = Math.round(s / 60);
    return m === 1 ? "1 minuto" : `${m} minutos`;
  }
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h} h ${m} min`;
}

/** Duração curta: "48 s", "1 min 6 s", "1 h 2 min". */
export function shortDuration(s: number) {
  const total = Math.max(0, Math.round(s));
  if (total < 60) return `${total} s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return sec ? `${m} min ${sec} s` : `${m} min`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function resolutionLabel(width: number) {
  if (width >= 3840) return "4K";
  if (width >= 1920) return "Full HD";
  if (width >= 1280) return "HD";
  return "baixa resolução";
}

export function videoSummary(v: Video) {
  return `${humanDuration(v.duration)} · ${resolutionLabel(v.width)}`;
}

export function videoTechnical(v: Video) {
  return `${v.width}×${v.height} · ${v.codec} · ${Math.round(v.fps)} fps · ${v.path}`;
}

export function fmtSize(bytes = 0) {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1).replace(".", ",")} GB`;
  return `${Math.max(1, Math.round(bytes / (1 << 20)))} MB`;
}

/** 0.084 -> "8,4%" */
export function fmtPercent(fraction: number, digits = 1) {
  return `${(fraction * 100).toFixed(digits).replace(/\.0+$/, "").replace(".", ",")}%`;
}

export function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}

export const SOURCE_TEXT: Record<string, string> = {
  arquivo: "horário tirado do nome do arquivo",
  metadados: "horário gravado pela câmera",
  manual: "horário informado por você",
};
