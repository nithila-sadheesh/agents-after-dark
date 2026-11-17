import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { Window } from './parts';

const W = 5.2;  // width (X)
const D = 4.2;  // depth (Z)
const H = 2.6;  // wall height
const BASE = 0.3;
const RISE = 1.75;
const OVERHANG = 0.45;
const ROOF_T = 0.2;

/** Cozy home with pitched roof, porch, chimney and warm windows. Door faces +Z. Origin at ground center. */
export default function House({ color = '#f2e8cf', roof = '#e08e7a' }: { color?: string; roof?: string }) {
  const wallTop = BASE + H;
  const half = D / 2;

  const gable = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-half, 0);
    s.lineTo(half, 0);
    s.lineTo(0, RISE);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: W - 0.02, bevelEnabled: false });
    g.translate(0, 0, -(W - 0.02) / 2);
    return g;
  }, [half]);

  // roof slab placement (front slope; back is mirrored)
  const Ls = Math.hypot(half, RISE);
  const a = Math.atan2(RISE, half);
  const n = [RISE / Ls, half / Ls];       // outward normal (z, y)
  const dn = [half / Ls, -RISE / Ls];     // down-slope direction (z, y)
  const cz = half / 2 + n[0] * ROOF_T / 2 + dn[0] * OVERHANG / 2;
  const cy = wallTop + RISE / 2 + n[1] * ROOF_T / 2 + dn[1] * OVERHANG / 2;

  return (
    <group>
      {/* foundation */}
      <RoundedBox args={[W + 0.25, BASE, D + 0.25]} radius={0.06} position={[0, BASE / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#9a8aa6" roughness={0.9} />
      </RoundedBox>
      {/* walls */}
      <RoundedBox args={[W, H, D]} radius={0.1} smoothness={3} position={[0, BASE + H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      {/* gable fill */}
      <mesh geometry={gable} position={[0, wallTop - 0.01, 0]} rotation-y={Math.PI / 2} castShadow>
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* roof slabs */}
      {[1, -1].map((s) => (
        <RoundedBox key={s} args={[W + 0.55, ROOF_T, Ls + OVERHANG]} radius={0.07} smoothness={2}
          position={[0, cy, s * cz]} rotation-x={s * a} castShadow receiveShadow>
          <meshStandardMaterial color={roof} roughness={0.75} />
        </RoundedBox>
      ))}
      <RoundedBox args={[W + 0.6, 0.2, 0.34]} radius={0.08} position={[0, wallTop + RISE + 0.1, 0]} castShadow>
        <meshStandardMaterial color="#c9705f" roughness={0.7} />
      </RoundedBox>
      {/* chimney */}
      <group position={[1.5, wallTop + 1.15, -0.95]}>
        <RoundedBox args={[0.6, 1.6, 0.6]} radius={0.06} castShadow>
          <meshStandardMaterial color="#b5838d" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[0.75, 0.16, 0.75]} radius={0.05} position={[0, 0.85, 0]} castShadow>
          <meshStandardMaterial color="#8e6470" roughness={0.9} />
        </RoundedBox>
      </group>
      {/* door */}
      <group position={[0, BASE, half]}>
        <RoundedBox args={[1.15, 1.85, 0.08]} radius={0.03} position={[0, 0.92, 0.02]}>
          <meshStandardMaterial color="#fffaf0" />
        </RoundedBox>
        <RoundedBox args={[0.9, 1.65, 0.1]} radius={0.04} position={[0, 0.84, 0.06]}>
          <meshStandardMaterial color="#6d597a" roughness={0.6} />
        </RoundedBox>
        <mesh position={[0.3, 0.85, 0.13]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#ffd166" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.38, 0.12]}>
          <circleGeometry args={[0.16, 20]} />
          <meshStandardMaterial color="#3b2a1c" emissive="#ffc977" emissiveIntensity={1.4} />
        </mesh>
      </group>
      {/* front windows with flower boxes */}
      {[-1.65, 1.65].map((x) => (
        <group key={x}>
          <Window position={[x, BASE + 1.45, half + 0.02]} w={1.0} h={0.95} />
          <RoundedBox args={[1.2, 0.2, 0.25]} radius={0.05} position={[x, BASE + 0.82, half + 0.14]} castShadow>
            <meshStandardMaterial color="#b07d62" />
          </RoundedBox>
          {[-0.4, -0.13, 0.13, 0.4].map((dx, i) => (
            <mesh key={dx} position={[x + dx, BASE + 0.97, half + 0.15]}>
              <sphereGeometry args={[0.11, 10, 8]} />
              <meshStandardMaterial color={i % 2 ? '#ff9fb2' : '#7cc47f'} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* side + gable windows */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Window position={[s * (W / 2 + 0.02), BASE + 1.45, 0]} rotationY={s * Math.PI / 2} w={0.95} h={0.9} />
          <group position={[s * (W / 2 + 0.03), wallTop + 0.62, 0]} rotation-y={s * Math.PI / 2}>
            <mesh>
              <circleGeometry args={[0.36, 24]} />
              <meshStandardMaterial color="#fffaf0" />
            </mesh>
            <mesh position-z={0.01}>
              <circleGeometry args={[0.27, 24]} />
              <meshStandardMaterial color="#3b2a1c" emissive="#ffc977" emissiveIntensity={1.2} />
            </mesh>
          </group>
        </group>
      ))}
      {/* porch */}
      <group position={[0, 0, half]}>
        <RoundedBox args={[2.4, 0.24, 1.0]} radius={0.05} position={[0, 0.12, 0.5]} castShadow receiveShadow>
          <meshStandardMaterial color="#c9ada7" roughness={0.9} />
        </RoundedBox>
        <RoundedBox args={[1.3, 0.12, 0.4]} radius={0.04} position={[0, 0.06, 1.15]} receiveShadow>
          <meshStandardMaterial color="#d8c3bd" roughness={0.9} />
        </RoundedBox>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} position={[x, 1.25, 0.88]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.1, 10]} />
            <meshStandardMaterial color="#fffaf0" />
          </mesh>
        ))}
        <RoundedBox args={[2.7, 0.14, 1.25]} radius={0.05} position={[0, 2.38, 0.55]} rotation-x={0.22} castShadow>
          <meshStandardMaterial color={roof} roughness={0.75} />
        </RoundedBox>
        {/* porch lamp */}
        <mesh position={[0.72, 2.0, 0.1]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#fff2c4" emissive="#ffcf7a" emissiveIntensity={6} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
