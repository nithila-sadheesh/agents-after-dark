import { useFoStore } from '../store';
import { DEMO_REQUEST, reset, startTask } from '../sim/orchestrator';
import { GLASS, isRunning } from './format';
import { IconLayers, IconPlay, IconReset, IconTarget } from './parts';

const btn = 'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px] font-medium transition';

export default function Controls() {
  const running = useFoStore((s) => isRunning(s.stage));
  const cameraMode = useFoStore((s) => s.camera.mode);
  const setCamera = (mode: 'overview' | 'follow') => useFoStore.setState({ camera: { mode } });
  const tone = (on: boolean) =>
    on ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/65 hover:bg-white/[0.07] hover:text-white';

  return (
    <div className={`pointer-events-auto absolute bottom-5 right-5 flex items-center gap-1 p-1.5 ${GLASS}`}>
      <button type="button" disabled={running} onClick={() => void startTask(DEMO_REQUEST, { mode: 'demo' })}
        className={`${btn} bg-linear-to-r from-indigo-500 to-violet-500 font-semibold text-white shadow-[0_6px_18px_-6px_rgba(129,140,248,0.9)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`}>
        <IconPlay className="h-3 w-3" /> Presentation mode
      </button>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <button type="button" onClick={() => setCamera('overview')} className={`${btn} ${tone(cameraMode === 'overview')}`}>
        <IconLayers className="h-3.5 w-3.5" /> Overview
      </button>
      <button type="button" onClick={() => setCamera('follow')} className={`${btn} ${tone(cameraMode === 'follow')}`}>
        <IconTarget className="h-3.5 w-3.5" /> Follow robot
      </button>
      <button type="button" onClick={reset} className={`${btn} ${tone(false)}`}>
        <IconReset className="h-3.5 w-3.5" /> Reset
      </button>
    </div>
  );
}
