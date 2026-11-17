import { useFoStore } from '../store';
import { DEMO_REQUEST, reset, startTask } from '../sim/orchestrator';
import { isRunning, SURFACE } from './format';
import { IconLayers, IconPlay, IconReset, IconTarget } from './parts';

const btn = 'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-colors';

export default function Controls() {
  const running = useFoStore((s) => isRunning(s.stage));
  const cameraMode = useFoStore((s) => s.camera.mode);
  const setCamera = (mode: 'overview' | 'follow') => useFoStore.setState({ camera: { mode } });
  const tone = (on: boolean) =>
    on ? 'bg-[#f3f3f3] text-[#0a0a0a]' : 'text-[#6b6b6b] hover:text-[#0a0a0a]';

  return (
    <div className={`pointer-events-auto absolute bottom-5 right-5 flex items-center gap-0.5 rounded-full p-1.5 ${SURFACE}`}>
      <button type="button" onClick={() => setCamera('overview')} className={`${btn} ${tone(cameraMode === 'overview')}`}>
        <IconLayers className="h-4 w-4" /> Overview
      </button>
      <button type="button" onClick={() => setCamera('follow')} className={`${btn} ${tone(cameraMode === 'follow')}`}>
        <IconTarget className="h-4 w-4" /> Follow robot
      </button>
      <button type="button" onClick={reset} className={`${btn} ${tone(false)}`}>
        <IconReset className="h-4 w-4" /> Reset
      </button>
      <button type="button" disabled={running} onClick={() => void startTask(DEMO_REQUEST, { mode: 'demo' })}
        className={`${btn} ml-1 bg-[#0a0a0a] pl-3 pr-4 font-semibold text-white hover:bg-[#262626] disabled:cursor-not-allowed disabled:bg-[#f3f3f3] disabled:text-[#a3a3a3]`}>
        <IconPlay className="h-3 w-3" /> Presentation mode
      </button>
    </div>
  );
}
