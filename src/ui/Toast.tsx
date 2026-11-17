import { useFoStore } from '../store';
import { replay, reset } from '../sim/orchestrator';
import { SURFACE } from './format';
import { IconCheck, IconPlay, IconReset } from './parts';

export default function Toast() {
  const toast = useFoStore((s) => s.toast);
  if (!toast) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center px-4">
      <div className={`fw-fade-down pointer-events-auto flex items-center gap-3.5 rounded-full py-2 pl-2 pr-2 ${SURFACE}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white">
          <IconCheck className="h-4 w-4" />
        </span>
        <div className="pr-2">
          <div className="text-[14px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">{toast}</div>
          <div className="text-[11.5px] text-[#8a8a8a]">Fo handled the calls. The robot handled the miles.</div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={replay}
            className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium text-[#0a0a0a] ring-1 ring-inset ring-[#e0e0e0] transition-colors hover:bg-[#f7f7f7]">
            <IconPlay className="h-3 w-3" /> Replay
          </button>
          <button type="button" onClick={reset}
            className="flex h-9 items-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#262626]">
            <IconReset className="h-3.5 w-3.5" /> New task
          </button>
        </div>
      </div>
    </div>
  );
}
