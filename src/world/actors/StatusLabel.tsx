// Monochrome (Wajo-style) status pill floating above the robot.
import { Html } from '@react-three/drei';
import { useFoStore } from '../../store';

export default function StatusLabel() {
  const status = useFoStore((s) => s.robot.status);
  const moving = useFoStore((s) => s.robot.moving);
  return (
    <Html position={[0, 2.15, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', userSelect: 'none',
          background: '#ffffff', color: '#000000', border: '1px solid #e5e5e5', borderRadius: 999,
          padding: '5px 10px 5px 8px', font: '500 12px/16px Inter, ui-sans-serif, system-ui, sans-serif',
          letterSpacing: '-0.01em', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <span
          className={moving ? 'animate-pulse' : undefined}
          style={{ width: 6, height: 6, borderRadius: 999, background: '#000000', flex: 'none' }}
        />
        {status}
      </div>
    </Html>
  );
}
