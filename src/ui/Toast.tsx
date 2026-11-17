import { useFoStore } from '../store';
import { replay, reset } from '../sim/orchestrator';
import { GLASS } from './format';
import { IconCheck, IconPlay, IconReset } from './parts';

export default function Toast() {
  const toast = useFoStore((s) => s.toast);
  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center px-4">
      <div className={`fw-fade-down pointer-events-auto relative flex items-center gap-3.5 overflow-hidden py-3 pl-3.5 pr-3 ${GLASS} ring-1 ring-emerald-300/15`}>
        <div className="pointer-events-none absolute -left-10 top-1/2 h-24 w-40 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-2xl" />
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-300 to-sky-400 text-slate-950 shadow-[0_0_20px_rgba(110,231,183,0.55)]">
          <IconCheck className="h-4 w-4" />
        </span>
        <div className="relative pr-1">
          <div className="text-[13.5px] font-semibold text-white">{toast}</div>
          <div className="text-[10.5px] text-white/45">Fo handled the calls. The robot handled the miles.</div>
        </div>
        <div className="relative flex gap-1.5">
          <button type="button" onClick={replay}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-[11.5px] font-medium text-white/85 ring-1 ring-white/10 transition hover:bg-white/12 hover:text-white">
            <IconPlay className="h-3 w-3" /> Replay
          </button>
          <button type="button" onClick={reset}
            className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-indigo-500 to-violet-500 px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:brightness-110">
            <IconReset className="h-3 w-3" /> New task
          </button>
        </div>
      </div>
    </div>
  );
}
