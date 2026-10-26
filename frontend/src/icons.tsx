/** Ícones de traço 2px (DESIGN.md 2.4). Sempre decorativos: o rótulo fica no botão. */
import { ReactNode } from "react";

function Icon({ size = 16, children, fill }: { size?: number; children: ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconCamera = ({ size = 22 }: P) => (
  <Icon size={size}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="M16 10l6-3v10l-6-3" />
  </Icon>
);
export const IconFolder = ({ size }: P) => (
  <Icon size={size}>
    <path d="M3 6h6l2 2h10v10H3z" />
  </Icon>
);
export const IconFolderMissing = ({ size }: P) => (
  <Icon size={size}>
    <path d="M3 6h6l2 2h10v10H3z" />
    <path d="M10 11l4 4M14 11l-4 4" />
  </Icon>
);
export const IconFile = ({ size }: P) => (
  <Icon size={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M10 9l5 3-5 3z" />
  </Icon>
);
export const IconChevronDown = ({ size = 14 }: P) => (
  <Icon size={size}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const IconChevronLeft = ({ size }: P) => (
  <Icon size={size}>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);
export const IconChevronRight = ({ size }: P) => (
  <Icon size={size}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);
export const IconDownload = ({ size }: P) => (
  <Icon size={size}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);
export const IconClose = ({ size = 18 }: P) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const IconSelect = ({ size }: P) => (
  <svg width={size ?? 16} height={size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="3 3" aria-hidden="true" style={{ flex: "none" }}>
    <rect x="4" y="4" width="16" height="16" />
  </svg>
);
export const IconFilter = ({ size }: P) => (
  <Icon size={size}>
    <path d="M4 5h16l-6 7v6l-4 2v-8z" />
  </Icon>
);
export const IconEnhance = ({ size }: P) => (
  <Icon size={size}>
    <circle cx="10" cy="10" r="6" />
    <path d="M15 15l5 5M10 7v6M7 10h6" />
  </Icon>
);
export const IconPlay = ({ size = 18 }: P) => (
  <Icon size={size} fill>
    <path d="M7 4l13 8-13 8z" />
  </Icon>
);
export const IconPause = ({ size = 18 }: P) => (
  <Icon size={size} fill>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </Icon>
);
export const IconPrevMotion = ({ size = 18 }: P) => (
  <Icon size={size}>
    <path d="M6 5v14M18 5l-9 7 9 7z" />
  </Icon>
);
export const IconNextMotion = ({ size = 18 }: P) => (
  <Icon size={size}>
    <path d="M18 5v14M6 5l9 7-9 7z" />
  </Icon>
);
export const IconAlert = ({ size = 18 }: P) => (
  <Icon size={size}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18v.5" />
  </Icon>
);
export const IconCheck = ({ size = 12 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5 9-10" />
  </svg>
);
export const IconCrosshair = ({ size }: P) => (
  <Icon size={size}>
    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
  </Icon>
);
export const IconTrash = ({ size }: P) => (
  <Icon size={size}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Icon>
);
export const IconStar = ({ size = 16, filled = false }: P & { filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
    <path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.1l-5.6 3.1 1.2-6.2L3 9.7l6.2-.8z" />
  </svg>
);
export const IconPencil = ({ size = 14 }: P) => (
  <Icon size={size}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Icon>
);
export const IconChain = ({ size = 16 }: P) => (
  <Icon size={size}>
    <path d="M4 12h4M16 12h4M8 7v10M16 7v10M8 12h8" />
  </Icon>
);
export const IconLoop = ({ size = 14 }: P) => (
  <Icon size={size}>
    <path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4" />
  </Icon>
);
