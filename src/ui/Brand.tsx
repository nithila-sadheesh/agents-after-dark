import { useEffect } from 'react';
import { useFoStore } from '../store';
import { checkFoStatus } from '../sim/orchestrator';
import { GLASS } from './format';

let statusChecked = false; // StrictMode double-mounts in dev; check Fo once per page load.

export default function Brand() {
  const fo = useFoStore((s) => s.fo);

  useEffect(() => {
    if (statusChecked) return;
    statusChecked = true;
    void checkFoStatus();
  }, []);

  const state = fo.connected === null ? 'checking' : fo.connected && fo.authenticated !== false ? 'on' : 'off';
  const badge = {
    checking: { text: 'Checking Fo…', cls: 'text-white/55 ring-white/10 bg-white/5', dot: 'bg-white/50 animate-pulse' },
    on: { text: 'Fo connected', cls: 'text-emerald-200 ring-emerald-400/30 bg-emerald-400/10', dot: 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]' },
    off: { text: 'Fo not connected — staged mode', cls: 'text-amber-200 ring-amber-400/30 bg-amber-400/10', dot: 'bg-amber-300' },
  }[state];

  return (
    <div className={`pointer-events-auto absolute left-5 top-5 select-none px-4 py-3 ${GLASS}`}>
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="fw-glow absolute -inset-1 rounded-full bg-violet-400/40 blur-[3px]" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-linear-to-br from-sky-300 to-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.9)]" />
        </span>
        <h1 className="text-[18px] font-semibold leading-none tracking-tight text-white">
          Fo<span className="bg-linear-to-r from-sky-300 to-violet-300 bg-clip-text text-transparent">World</span>
        </h1>
      </div>
      <p className="mt-1.5 text-[11.5px] text-white/55">Your physical world, one command away.</p>
      <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 transition-colors duration-500 ${badge.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
        {badge.text}
      </div>
    </div>
  );
}
