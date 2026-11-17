import { Html } from '@react-three/drei';
import type { Vec3 } from '../../../shared/types';

/** Glassy dark pill rendered in screen space above a 3D point. */
export default function FloatingLabel({ text, position, live = false, dim = false }: {
  text: string; position: Vec3; live?: boolean; dim?: boolean;
}) {
  return (
    <Html position={position} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 px-3 py-1 text-[12px] font-medium tracking-tight text-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md select-none ${dim ? 'bg-slate-950/45' : 'bg-slate-950/70'}`}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-sky-300/80'}`} />
        {text}
      </div>
    </Html>
  );
}
