import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HOME_ANCHOR, SHOP_ANCHOR } from '../../../shared/world';
import { useFoStore, type Selectable } from '../../store';
import { damp, getGlowTexture, itemDisplay, robotDisplay } from '../worldState';

const RADIUS: Record<Selectable, number> = { robot: 1.15, home: 3.9, shop: 4.3, item: 0.65 };
const WHITE = new THREE.Color('#ffffff');
const HOME_V = new THREE.Vector3(...HOME_ANCHOR);
const SHOP_V = new THREE.Vector3(...SHOP_ANCHOR);

function Ring({ kind, accent }: { kind: Selectable; accent: string }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const vis = useRef(0);
  const color = useRef(new THREE.Color());

  useFrame(({ clock }, dt) => {
    if (!g.current || !ring.current || !halo.current) return;
    const s = useFoStore.getState();
    const hl = s.highlights.includes(kind);
    const sel = s.selected === kind;
    vis.current += ((hl ? 1 : sel ? 0.7 : 0) - vis.current) * damp(6, dt);
    g.current.visible = vis.current > 0.01;
    if (!g.current.visible) return;
    const p = kind === 'robot' ? robotDisplay.position : kind === 'item' ? itemDisplay.position
      : kind === 'home' ? HOME_V : SHOP_V;
    g.current.position.set(p.x, 0.09, p.z);
    const t = clock.elapsedTime;
    const pulse = hl ? 0.5 + 0.5 * Math.sin(t * 3.2) : 0.6;
    g.current.scale.setScalar(1 + (hl ? 0.06 * Math.sin(t * 3.2) : 0));
    color.current.set(accent);
    if (!hl) color.current.lerp(WHITE, 0.7);
    ring.current.color.copy(color.current).multiplyScalar(1.5 + pulse * 1.5);
    ring.current.opacity = vis.current * (0.55 + 0.45 * pulse);
    halo.current.color.copy(color.current);
    halo.current.opacity = vis.current * (0.2 + 0.25 * pulse);
  });

  const r = RADIUS[kind];
  return (
    <group ref={g} visible={false}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={4}>
        <ringGeometry args={[r * 0.9, r, 64]} />
        <meshBasicMaterial ref={ring} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={4}>
        <planeGeometry args={[r * 2.6, r * 2.6]} />
        <meshBasicMaterial ref={halo} map={getGlowTexture()} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Soft pulsing rings under highlighted (accent) or selected (white) objects. */
export default function Highlights({ accent = '#7c9cff' }: { accent?: string }) {
  return (
    <>
      {(['robot', 'home', 'shop', 'item'] as Selectable[]).map((k) => <Ring key={k} kind={k} accent={accent} />)}
    </>
  );
}
