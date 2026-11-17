// Hero dry cleaner (mixed-use, 4 storeys) in SHOP_LOT; storefront at SHOP_FACADE_Z facing +Z, door at x=0.
// shopActive: interior + sign brighten and the sliding doors open. Simplified build (deadline).
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import signFont from '@fontsource/inter/files/inter-latin-800-normal.woff?url';
import { useFoStore } from '../../store';
import { damp, onSelect, useHover } from '../worldState';
import { SIDEWALK_TOP } from '../city/roads/layout';
import { B, BrickBox, Boxes, LightPool, Windows, windowSet, type Bx } from './common';

const Z = 32;
const BRICK = '#b48a62';
const FRAME = '#1d3b33';
const WINS = windowSet([7.6, 10.8, 4.4].flatMap((fy, f) => [-6.75, -2.25, 2.25, 6.75].map((x, i) =>
  [x, fy + 0.9, 1.2, 1.95, (f + i) % 3 === 0] as [number, number, number, number, boolean])), Z);
// striped awning: sloped canopy + front valance, alternating stripes
const SW = 16.4 / 33;
const STRIPES: [Bx[], Bx[]] = [[], []];
for (let i = 0; i < 33; i++) {
  const x0 = -8.2 + i * SW, x1 = x0 + SW;
  STRIPES[i % 2].push([x0, x1, 2.93, 2.97, Z + 0.7 - 0.75, Z + 0.7 + 0.75, 0.45], [x0, x1, 2.36, 2.64, Z + 1.36, Z + 1.4]);
}
const CORNICE: Bx[] = Array.from({ length: 16 }, (_, i): Bx => { const x = -8.6 + i * (17.2 / 15); return [x - 0.1, x + 0.1, 13.4, 14, Z, Z + 0.5]; });
const BAGS: Bx[] = Array.from({ length: 64 }, (_, i): Bx => { const x = -7.6 + i * 0.24; return [x - 0.06, x + 0.06, 1.3, 2.52, 26.7, 27.34]; });
const GARMENTS = ['#1f2a44', '#e9e9e4', '#5a5f66', '#7a2633', '#c8b48f', '#202020', '#3d5a80', '#efe9dc'];

export default function HeroShop() {
  const label = useFoStore((s) => s.scene.shopLabel) || 'DRY CLEANERS';
  const active = useFoStore((s) => s.shopActive);
  const on = useFoStore((s) => s.highlights.includes('shop'));
  const { bind } = useHover();
  const lvl = useRef(active ? 1 : 0);
  const signMat = useRef<THREE.MeshBasicMaterial>(null);
  const openMat = useRef<THREE.MeshBasicMaterial>(null);
  const ceil = useRef<THREE.MeshStandardMaterial>(null);
  const band = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const doorL = useRef<THREE.Group>(null);
  const doorR = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    lvl.current += ((active ? 1 : 0) - lvl.current) * damp(3, dt);
    const l = lvl.current;
    signMat.current?.color.set('#fff3d6').multiplyScalar(1.1 + 2.4 * l);
    openMat.current?.color.set('#ff3b5c').multiplyScalar(1.4 + 2.2 * l);
    if (ceil.current) ceil.current.emissiveIntensity = 1.2 + 2.2 * l;
    if (band.current) band.current.emissiveIntensity = 0.8 + 1.2 * l;
    if (light.current) light.current.intensity = 6 + 30 * l;
    if (doorL.current) doorL.current.position.x = -l * 1.0;
    if (doorR.current) doorR.current.position.x = l * 1.0;
  });

  const fontSize = Math.min(0.62, 11 / Math.max(6, label.length * 0.75));
  const clean = /CLEAN/i.test(label);

  return (
    <group position-y={SIDEWALK_TOP}>
      <mesh position={[0, 7.5, 23.5]} onClick={onSelect('shop')} {...bind}>
        <boxGeometry args={[18, 15, 17.2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* upper floors + piers + cornice */}
      <BrickBox x={[-9, 9]} y={[4.4, 14]} z={[15, Z]} c={BRICK} />
      <BrickBox x={[-9, 9]} y={[0, 4.4]} z={[15, 25.5]} c={BRICK} />
      <BrickBox x={[-9, -8.3]} y={[0, 4.4]} z={[25.5, Z]} c={BRICK} />
      <BrickBox x={[8.3, 9]} y={[0, 4.4]} z={[25.5, Z]} c={BRICK} />
      <B x={[-9.2, 9.2]} y={[14, 14.8]} z={[15, Z + 0.6]} c="#d9d0bf" r={0.7} />
      <Boxes items={CORNICE}><meshStandardMaterial color="#d9d0bf" roughness={0.7} /></Boxes>
      <Windows set={WINS} trim="#1f2a26" stone="#d9d0bf" />
      {/* sign band + storefront frame */}
      <B x={[-8.4, 8.4]} y={[3.3, 4.45]} z={[Z - 0.02, Z + 0.12]} c="#8d9196" r={0.35} m={0.7} />
      <mesh position={[0, 3.875, Z + 0.075]}>
        <boxGeometry args={[16.6, 1.05, 0.15]} />
        <meshStandardMaterial ref={band} color="#16233a" emissive="#1c3a63" emissiveIntensity={0.8} roughness={0.4} />
      </mesh>
      <Text font={signFont} position={[0, 3.88, Z + 0.17]} fontSize={fontSize} letterSpacing={0.06} anchorX="center" anchorY="middle">
        {label}
        <meshBasicMaterial ref={signMat} color="#fff3d6" toneMapped={false} />
      </Text>
      <B x={[-8.3, 8.3]} y={[3.0, 3.35]} z={[Z - 0.05, Z + 0.05]} c="#8d9196" r={0.4} m={0.6} />
      <B x={[-8.3, -1.2]} y={[0, 0.55]} z={[Z - 0.1, Z]} c={FRAME} r={0.5} />
      <B x={[1.2, 8.3]} y={[0, 0.55]} z={[Z - 0.1, Z]} c={FRAME} r={0.5} />
      {[-8.25, -4.7, -1.2, 1.2, 4.7, 8.25].map((x) => (
        <B key={x} x={[x - 0.05, x + 0.05]} y={[0.55, 3.0]} z={[Z - 0.1, Z]} c={FRAME} r={0.5} />
      ))}
      {/* display glass (transparent) */}
      <mesh position={[0, 1.78, Z - 0.05]}>
        <planeGeometry args={[16.4, 2.45]} />
        <meshStandardMaterial color="#cfe3ea" transparent opacity={0.08} roughness={0.05} metalness={0} depthWrite={false} />
      </mesh>
      {/* striped awning */}
      <Boxes items={STRIPES[0]}><meshStandardMaterial color="#1f5b44" roughness={0.85} side={THREE.DoubleSide} /></Boxes>
      <Boxes items={STRIPES[1]}><meshStandardMaterial color="#efe6d2" roughness={0.85} side={THREE.DoubleSide} /></Boxes>
      {/* interior */}
      <B x={[-8.3, 8.3]} y={[0, 0.02]} z={[25.5, Z - 0.1]} c="#d9d2c2" r={0.6} cast={false} />
      <B x={[-8.3, 8.3]} y={[0, 3.9]} z={[25.5, 25.6]} c="#e8dcc6" r={0.9} cast={false} />
      <mesh position={[0, 3.88, 28.7]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[14, 4]} />
        <meshStandardMaterial ref={ceil} color="#ffffff" emissive="#fff1d8" emissiveIntensity={1.2} />
      </mesh>
      <B x={[-5.5, 5.5]} y={[0, 1.05]} z={[28.8, 29.4]} c="#6b4a33" r={0.6} />
      <B x={[-5.6, 5.6]} y={[1.05, 1.1]} z={[28.75, 29.45]} c="#d8d2c6" r={0.3} />
      <B x={[-7.8, 7.8]} y={[2.5, 2.55]} z={[27.0, 27.05]} c="#c9cbd0" r={0.3} m={0.8} />
      {/* garments in plastic bags along the conveyor rail */}
      <instancedMesh args={[undefined, undefined, 64]} castShadow={false} ref={(m) => {
        if (!m || m.userData.done) return;
        const o = new THREE.Object3D(); const c = new THREE.Color();
        for (let i = 0; i < 64; i++) {
          o.position.set(-7.6 + i * 0.24, 1.95, 27.02); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
          m.setColorAt(i, c.set(GARMENTS[(i * 5 + (i >> 2)) % GARMENTS.length]));
        }
        m.userData.done = true; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }}>
        <boxGeometry args={[0.08, 1.1, 0.55]} />
        <meshStandardMaterial roughness={0.35} metalness={0.05} />
      </instancedMesh>
      {/* clear plastic garment bags */}
      <Boxes items={BAGS} cast={false}>
        <meshPhysicalMaterial color="#eef4f8" transparent opacity={0.3} roughness={0.12} clearcoat={1} depthWrite={false} />
      </Boxes>
      <pointLight ref={light} position={[0, 3.2, 29.5]} color="#ffd9a8" intensity={6} distance={11} decay={2} />
      {/* sliding glass doors */}
      {[[doorL, -0.575], [doorR, 0.575]].map(([ref, x], i) => (
        <group key={i} ref={ref as RefObject<THREE.Group | null>}>
          <B x={[(x as number) - 0.55, (x as number) + 0.55]} y={[0, 2.6]} z={[Z - 0.16, Z - 0.12]} c="#bcd3da" r={0.05} m={0.4} cast={false} />
        </group>
      ))}
      {/* OPEN neon */}
      <Text font={signFont} position={[5.2, 2.2, Z - 0.15]} fontSize={0.36} letterSpacing={0.08} anchorX="center" anchorY="middle">
        OPEN
        <meshBasicMaterial ref={openMat} color="#ff3b5c" toneMapped={false} />
      </Text>
      <Text font={signFont} position={[-4.7, 2.7, Z + 0.01]} fontSize={0.2} letterSpacing={0.1} anchorX="center" anchorY="middle" color="#ffffff">
        {clean ? 'SAME DAY SERVICE  ·  TAILORING' : 'PACKING  ·  SHIPPING  ·  MAILBOXES'}
      </Text>
      {/* robot drop-off sign by the door */}
      <B x={[-1.95, -1.35]} y={[1.0, 1.6]} z={[Z + 0.005, Z + 0.02]} c="#f4f4f0" r={0.6} cast={false} />
      <Text font={signFont} position={[-1.65, 1.3, Z + 0.03]} fontSize={0.07} maxWidth={0.5} textAlign="center" anchorX="center" anchorY="middle" color="#111111">
        {'ROBOT\nDROP-OFF'}
      </Text>
      <LightPool position={[0, 0.07, 34]} size={[14, 5]} on={on} />
    </group>
  );
}
