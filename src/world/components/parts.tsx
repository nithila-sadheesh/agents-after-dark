import { RoundedBox } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { Vec3 } from '../../../shared/types';

/** Framed window with emissive glass, facing +Z. */
export function Window({ position, rotationY = 0, w = 1, h = 0.9, glow = 1.1, light = '#ffc977', frame = '#fffaf0', children }: {
  position: Vec3; rotationY?: number; w?: number; h?: number; glow?: number; light?: string; frame?: string; children?: ReactNode;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      <RoundedBox args={[w + 0.18, h + 0.18, 0.08]} radius={0.03} smoothness={2}>
        <meshStandardMaterial color={frame} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#3b2a1c" emissive={light} emissiveIntensity={glow} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[0.05, h, 0.02]} />
        <meshStandardMaterial color={frame} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[w, 0.05, 0.02]} />
        <meshStandardMaterial color={frame} />
      </mesh>
      {children}
    </group>
  );
}

/** Wheel aligned with the X axle. */
export function Wheel({ position, r = 0.24, width = 0.16, color = '#2b2d42', hub = '#c9cbe0' }: {
  position: Vec3; r?: number; width?: number; color?: string; hub?: string;
}) {
  return (
    <group position={position}>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r, r, width, 20]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[r * 0.5, r * 0.5, width + 0.02, 14]} />
        <meshStandardMaterial color={hub} roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
}
