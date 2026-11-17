import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import { damp } from '../worldState';
// Bundled font so sign text renders offline (drei Text otherwise fetches a font from a CDN).
import signFont from '@fontsource/inter/files/inter-latin-800-normal.woff?url';

const W = 6.2;
const D = 4.4;
const H = 3.2;
const BASE = 0.3;
const FRONT = D / 2;

const SIGN_TEXT = new THREE.Color('#fff1cf');
const GLASS_IDLE = new THREE.Color('#ffd89a');
const GLASS_ACTIVE = new THREE.Color('#fff4dc');

/** Storefront facing +Z with striped awning, big windows and a rooftop sign. `active` lights it up for the handoff. */
export default function Store({ label = 'DRY CLEANERS', color = '#a8dadc', active = false, accent = '#7c9cff' }: {
  label?: string; color?: string; active?: boolean; accent?: string;
}) {
  const glass = useRef<THREE.MeshStandardMaterial[]>([]);
  const textMat = useRef<THREE.MeshBasicMaterial>(null);
  const border = useRef<THREE.MeshStandardMaterial>(null);
  const openSign = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const level = useRef(active ? 1 : 0);

  useFrame(({ clock }, dt) => {
    level.current += ((active ? 1 : 0) - level.current) * damp(5, dt);
    const l = level.current;
    const flicker = active ? 0.9 + 0.1 * Math.sin(clock.elapsedTime * 6) : 1;
    for (const m of glass.current) {
      if (!m) continue;
      m.emissive.copy(GLASS_IDLE).lerp(GLASS_ACTIVE, l);
      m.emissiveIntensity = 0.55 + l * 2.2;
    }
    textMat.current?.color.copy(SIGN_TEXT).multiplyScalar(0.95 + l * 2.6 * flicker);
    if (border.current) border.current.emissiveIntensity = 0.4 + l * 3.5 * flicker;
    openSign.current?.color.set('#ff6fae').multiplyScalar(0.25 + l * 3.2);
    if (light.current) light.current.intensity = l * 14;
  });

  const fontSize = Math.min(0.52, 4.3 / Math.max(1, label.length * 0.8)); // tuned for bundled Inter 800
  const stripes = 8;
  const glassMat = (i: number) => (m: THREE.MeshStandardMaterial | null) => { if (m) glass.current[i] = m; };

  return (
    <group>
      <RoundedBox args={[W + 0.25, BASE, D + 0.25]} radius={0.06} position={[0, BASE / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#9a8aa6" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[W, H, D]} radius={0.1} smoothness={3} position={[0, BASE + H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {/* cornice / roof */}
      <RoundedBox args={[W + 0.35, 0.32, D + 0.35]} radius={0.08} position={[0, BASE + H + 0.12, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, BASE + H + 0.285, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W - 0.2, D - 0.2]} />
        <meshStandardMaterial color="#6d7a96" roughness={0.95} />
      </mesh>
      <mesh position={[1.6, BASE + H + 0.55, -0.9]} castShadow>
        <boxGeometry args={[1.1, 0.6, 0.9]} />
        <meshStandardMaterial color="#b9b4c9" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* storefront base strip */}
      <RoundedBox args={[W - 0.3, 0.4, 0.12]} radius={0.04} position={[0, BASE + 0.2, FRONT + 0.04]}>
        <meshStandardMaterial color="#2f3e46" roughness={0.6} />
      </RoundedBox>
      {/* big windows + glass door */}
      {[[-1.9, 1.25, 1.85, 1.55], [1.9, 1.25, 1.85, 1.55], [0, 1.05, 1.05, 1.95]].map(([x, y, w, h], i) => (
        <group key={i} position={[x, BASE + y + 0.1, FRONT + 0.02]}>
          <RoundedBox args={[w + 0.16, h + 0.16, 0.08]} radius={0.03}>
            <meshStandardMaterial color="#2f3e46" roughness={0.5} />
          </RoundedBox>
          <mesh position-z={0.045}>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial ref={glassMat(i)} color="#24303a" emissive="#ffd89a" emissiveIntensity={0.55} roughness={0.15} />
          </mesh>
        </group>
      ))}
      {/* garments on a rack inside the left window */}
      <group position={[-1.9, BASE + 1.85, FRONT + 0.075]}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 6]} />
          <meshStandardMaterial color="#c9cbe0" metalness={0.5} roughness={0.3} />
        </mesh>
        {['#7c9cff', '#ff9fb2', '#ffffff', '#ffd166', '#81b29a'].map((c, i) => (
          <RoundedBox key={c} args={[0.24, 0.62, 0.02]} radius={0.01} position={[-0.6 + i * 0.3, -0.34, 0]}>
            <meshStandardMaterial color={c} roughness={0.8} />
          </RoundedBox>
        ))}
      </group>
      {/* neon OPEN sign in the right window */}
      <Text font={signFont} position={[1.9, BASE + 1.85, FRONT + 0.08]} fontSize={0.3} fontWeight={700} letterSpacing={0.08} anchorX="center" anchorY="middle">
        OPEN
        <meshBasicMaterial ref={openSign} color="#ff6fae" toneMapped={false} />
      </Text>
      {/* striped awning */}
      <group position={[0, BASE + 2.55, FRONT + 0.55]} rotation-x={0.42}>
        {Array.from({ length: stripes }, (_, i) => (
          <mesh key={i} position={[-W / 2 + 0.1 + (i + 0.5) * ((W - 0.2) / stripes), 0, 0]} castShadow>
            <boxGeometry args={[(W - 0.2) / stripes, 0.07, 1.2]} />
            <meshStandardMaterial color={i % 2 ? '#fdfcff' : accent} roughness={0.8} />
          </mesh>
        ))}
      </group>
      <RoundedBox args={[W - 0.2, 0.2, 0.06]} radius={0.02} position={[0, BASE + 2.22, FRONT + 1.08]} castShadow>
        <meshStandardMaterial color={accent} roughness={0.8} />
      </RoundedBox>
      {/* rooftop sign */}
      <group position={[0, BASE + H + 0.95, FRONT - 0.15]}>
        {[-1.8, 1.8].map((x) => (
          <mesh key={x} position={[x, -0.5, -0.05]}>
            <boxGeometry args={[0.1, 0.6, 0.1]} />
            <meshStandardMaterial color="#2f3e46" />
          </mesh>
        ))}
        <RoundedBox args={[5.1, 0.98, 0.14]} radius={0.08} position-z={-0.03}>
          <meshStandardMaterial ref={border} color={accent} emissive={accent} emissiveIntensity={0.4} toneMapped={false} />
        </RoundedBox>
        <RoundedBox args={[4.9, 0.8, 0.18]} radius={0.06}>
          <meshStandardMaterial color="#1d2340" roughness={0.5} />
        </RoundedBox>
        <Text font={signFont} position={[0, 0, 0.1]} fontSize={fontSize} fontWeight={800} letterSpacing={0.06} anchorX="center" anchorY="middle" maxWidth={4.6}>
          {label}
          <meshBasicMaterial ref={textMat} color="#fff1cf" toneMapped={false} />
        </Text>
      </group>
      <pointLight ref={light} position={[0, 2.2, FRONT + 1.6]} color="#ffe2a8" intensity={0} distance={9} decay={1.6} />
    </group>
  );
}
