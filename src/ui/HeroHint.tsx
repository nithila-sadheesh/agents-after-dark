import { useFoStore } from '../store';

export default function HeroHint() {
  const visible = useFoStore((s) => s.stage === 'IDLE' && s.messages.length === 0);
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-6 flex flex-col items-center px-6 text-center transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <h2 className="fw-text-shadow text-[length:clamp(22px,2.4vw,34px)] font-semibold tracking-tight text-white/90">
        Your physical world,{' '}
        <span className="bg-linear-to-r from-sky-200 via-indigo-200 to-violet-300 bg-clip-text text-transparent">one command away.</span>
      </h2>
      <p className="fw-text-shadow mt-2 text-[13px] text-white/60">
        Ask Fo for an errand below, or hit ▶ Presentation mode to watch the robot run one.
      </p>
    </div>
  );
}
