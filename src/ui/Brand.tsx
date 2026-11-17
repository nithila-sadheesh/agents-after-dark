import { useEffect } from 'react';
import { useFoStore } from '../store';
import { checkFoStatus } from '../sim/orchestrator';
import { SURFACE } from './format';
import { FoMark } from './parts';

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
    checking: { text: 'Checking Fo…', cls: 'text-[#8a8a8a]', dot: 'bg-[#bdbdbd] animate-pulse' },
    on: { text: 'Fo connected', cls: 'text-[#0a0a0a]', dot: 'bg-[#0a0a0a]' },
    off: { text: 'Fo not connected', cls: 'text-[#8a8a8a]', dot: 'bg-white ring-1 ring-[#a3a3a3]' },
  }[state];

  return (
    <div className={`pointer-events-auto absolute left-5 top-5 flex h-11 select-none items-center gap-3 rounded-full pl-3 pr-4 ${SURFACE}`}>
      <div className="flex items-center gap-1.5">
        <FoMark className="h-7 w-7 text-[#0a0a0a]" />
        <h1 className="text-[16px] font-bold leading-none tracking-[-0.035em] text-[#0a0a0a]">FoWorld</h1>
      </div>
      <span className="h-4 w-px bg-[#e5e5e5]" />
      <div className={`flex items-center gap-1.5 text-[11.5px] font-medium transition-colors duration-500 ${badge.cls}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
        {badge.text}
      </div>
    </div>
  );
}
