// Subtle emphasis under the robot / item: a soft light pool plus a thin ring (highlighted > selected).
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useFoStore } from '../../store';
import { damp, getGlowTexture, itemDisplay, robotDisplay } from '../worldState';

function Pool({ kind, r }: { kind: 'robot' | 'item'; r: number }) {
  const g = useRef<THREE.Group>(null);
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const vis = useRef(0);
  useFrame(({ clock }, dt) => {
    if (!g.current || !pool.current || !ring.current) return;
    const s = useFoStore.getState();
    const hl = s.highlights.includes(kind);
    vis.current += ((hl ? 1 : s.selected === kind ? 0.6 : 0) - vis.current) * damp(6, dt);
    g.current.visible = vis.current > 0.01;
    if (!g.current.visible) return;
    const p = kind === 'robot' ? robotDisplay.position : itemDisplay.position;
    g.current.position.set(p.x, 0.02, p.z);
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4);
    pool.current.opacity = vis.current * (0.22 + 0.1 * pulse);
    ring.current.opacity = vis.current * (0.35 + 0.2 * pulse);
  });
  return (
    <group ref={g} visible={false}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <planeGeometry args={[r * 3, r * 3]} />
        <meshBasicMaterial ref={pool} map={getGlowTexture()} color="#fff4e2" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[r * 0.97, r, 64]} />
        <meshBasicMaterial ref={ring} color="#ffffff" transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function Highlights() {
  return <><Pool kind="robot" r={1.5} /><Pool kind="item" r={0.6} /></>;
}
