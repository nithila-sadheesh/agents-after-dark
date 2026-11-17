// Small shared icons, badges and the pill prompt input for the overlay. Monochrome, thin strokes.
import type { ReactNode } from 'react';

type P = { className?: string };

const Svg = ({ className = 'h-3.5 w-3.5', children }: P & { children: ReactNode }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"
    strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const IconCheck = (p: P) => <Svg {...p}><path d="M3.5 8.5l3 3 6-7" /></Svg>;
export const IconX = (p: P) => <Svg {...p}><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M8 13V3.5M4 7.5L8 3.5l4 4" /></Svg>;
export const IconArrowUpRight = (p: P) => <Svg {...p}><path d="M5 11l6-6M6 5h5v5" /></Svg>;
export const IconChevron = (p: P) => <Svg {...p}><path d="M4 6l4 4 4-4" /></Svg>;
export const IconPlay = (p: P) => <Svg {...p}><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" /></Svg>;
export const IconLayers = (p: P) => <Svg {...p}><path d="M2 5.5L8 2.5l6 3-6 3zM2 8.5l6 3 6-3M2 11.5l6 3 6-3" /></Svg>;
export const IconTarget = (p: P) => (
  <Svg {...p}><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.4" fill="currentColor" /></Svg>
);
export const IconReset = (p: P) => (
  <Svg {...p}><path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1" /><path d="M13.5 2v3h-3" /></Svg>
);
export const IconSparkle = (p: P) => (
  <Svg {...p}><path d="M8 2c.4 3.2 2.8 5.6 6 6-3.2.4-5.6 2.8-6 6-.4-3.2-2.8-5.6-6-6 3.2-.4 5.6-2.8 6-6z" /></Svg>
);
export const IconRobot = (p: P) => (
  <Svg {...p}><rect x="2.5" y="5" width="11" height="8" rx="2.2" /><path d="M8 2.2V5M6 9h.01M10 9h.01" /></Svg>
);
export const IconSystem = (p: P) => (
  <Svg {...p}><circle cx="8" cy="8" r="2.4" /><path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" /></Svg>
);
export const IconHanger = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 4.6a1.5 1.5 0 1 1 2.1 1.4c-.4.2-.6.5-.6.9V8" />
    <path d="M8 8l5.6 3.5c.5.3.3 1-.3 1H2.7c-.6 0-.8-.7-.3-1z" />
  </Svg>
);
export const IconBox = (p: P) => (
  <Svg {...p}><path d="M2.5 5L8 2.5 13.5 5v6L8 13.5 2.5 11z" /><path d="M2.5 5L8 7.5 13.5 5M8 7.5v6" /></Svg>
);

/** Wajo's Fo mascot: two tall oval eyes over a tiny smile (•‿•). Inherits currentColor. */
export const FoMark = ({ className = 'h-5 w-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <ellipse cx="8.6" cy="9.6" rx="2" ry="3.3" fill="currentColor" />
    <ellipse cx="15.4" cy="9.6" rx="2" ry="3.3" fill="currentColor" />
    <path d="M10 16.4q2 1.7 4 0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
);

/** Fo avatar: the mark inside a light grey circle. */
export const FoAvatar = ({ className = 'h-6 w-6' }: P) => (
  <span className={`flex shrink-0 items-center justify-center rounded-full bg-[#f3f3f3] text-[#0a0a0a] ${className}`}>
    <FoMark className="h-[70%] w-[70%]" />
  </span>
);

export const Spinner = ({ className = 'h-3 w-3' }: P) => (
  <span className={`inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`} />
);

/** "Live" badge for output genuinely produced by Fo / Claude; other entries show no badge. */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#0a0a0a] px-1.5 py-px text-[9.5px] font-semibold leading-[14px] text-white"
      title="Genuine output from Fo / Claude">
      <span className="h-1 w-1 rounded-full bg-white" />Live
    </span>
  ) : null;
}

/** Renders Fo's markdown-style **bold** as <strong>; everything else stays verbatim text. */
export function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      : part)}</>;
}

/** Wajo-style prompt: light grey rounded-full field with a circular send button (black once there is text). */
export function PromptInput({ value, onChange, onSubmit, disabled, placeholder, size = 'md' }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder: string;
  size?: 'md' | 'lg';
}) {
  const lg = size === 'lg';
  const ready = !disabled && !!value.trim();
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className={`flex items-center rounded-full bg-[#f3f3f3] transition-shadow focus-within:ring-1 focus-within:ring-[#d4d4d4] ${
        lg ? 'h-14 pl-6 pr-2' : 'h-11 pl-4 pr-1.5'} ${disabled ? 'opacity-60' : ''}`}>
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className={`min-w-0 flex-1 bg-transparent text-[#0a0a0a] outline-none placeholder:text-[#8f8f8f] disabled:cursor-not-allowed ${
          lg ? 'text-[15px]' : 'text-[13.5px]'}`} />
      <button type="submit" disabled={!ready} aria-label="Send"
        className={`flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${
          lg ? 'h-10 w-10' : 'h-8 w-8'} ${ready ? 'bg-[#0a0a0a] text-white hover:bg-[#262626]' : 'bg-[#e2e2e2] text-[#8f8f8f]'}`}>
        <IconSend className={lg ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
      </button>
    </form>
  );
}
