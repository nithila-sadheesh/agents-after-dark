// Small shared icons + badges for the overlay.
import type { ReactNode } from 'react';

type P = { className?: string };

const Svg = ({ className = 'h-3.5 w-3.5', children }: P & { children: ReactNode }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
    strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const IconCheck = (p: P) => <Svg {...p}><path d="M3.5 8.5l3 3 6-7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M4 6l4 4 4-4" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" /></Svg>;
export const IconLayers = (p: P) => <Svg {...p}><path d="M2 5.5L8 2.5l6 3-6 3zM2 8.5l6 3 6-3M2 11.5l6 3 6-3" /></Svg>;
export const IconTarget = (p: P) => (
  <Svg {...p}><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.6" fill="currentColor" /></Svg>
);
export const IconReset = (p: P) => (
  <Svg {...p}><path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1" /><path d="M13.5 2v3h-3" /></Svg>
);
export const IconSparkle = (p: P) => (
  <Svg {...p}><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" /></Svg>
);
export const IconChat = (p: P) => (
  <Svg {...p}><path d="M3 3.5h10a1 1 0 011 1v6a1 1 0 01-1 1H7.5L4.5 14v-2.5H3a1 1 0 01-1-1v-6a1 1 0 011-1z" /></Svg>
);
export const IconRobot = (p: P) => (
  <Svg {...p}><rect x="2.5" y="5" width="11" height="8" rx="2.2" /><path d="M8 2.2V5M6 9h.01M10 9h.01" /></Svg>
);
export const IconSystem = (p: P) => (
  <Svg {...p}><circle cx="8" cy="8" r="2.4" /><path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" /></Svg>
);

export const Spinner = ({ className = 'h-3 w-3' }: P) => (
  <span className={`inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`} />
);

/** Honesty badge: LIVE = genuinely produced by Fo / Claude; SIMULATED = staged step. */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-1.5 py-px text-[9px] font-bold tracking-[0.08em] text-emerald-300 ring-1 ring-emerald-400/35"
      title="Genuine output from Fo / Claude">
      <span className="h-1 w-1 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.9)]" />LIVE
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-400/10 px-1.5 py-px text-[9px] font-bold tracking-[0.08em] text-amber-300/90 ring-1 ring-amber-400/30"
      title="Staged step, not real agent output">
      SIMULATED
    </span>
  );
}

/** Renders Fo's markdown-style **bold** as <strong>; everything else stays verbatim text. */
export function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : part)}</>;
}
