import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { Wheel } from './parts';
import { getGlowTexture } from '../worldState';

const GREENS = ['#6dbb75', '#83c98a', '#5aa469', '#9ad48f', '#78b7a0'];

/** Rounded blob tree (variant 0) or soft pine (variant 1). */
export function Tree({ color, variant = 0 }: { color?: string; variant?: number }) {
  const c = color ?? GREENS[variant % GREENS.length];
  if (variant % 3 === 2) {
    return (
      <group>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.2, 0.8, 8]} />
          <meshStandardMaterial color="#8a6a5c" roughness={0.9} />
        </mesh>
        {[[1.1, 1.5, 1.2], [0.85, 1.25, 2.0], [0.55, 1.0, 2.7]].map(([r, h, y], i) => (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <coneGeometry args={[r, h, 12]} />
            <meshStandardMaterial color={c} roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 1.3, 8]} />
        <meshStandardMaterial color="#8a6a5c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <sphereGeometry args={[1.05, 18, 14]} />
        <meshStandardMaterial color={c} roughness={0.85} />
      </mesh>
      <mesh position={[0.6, 1.55, 0.3]} castShadow>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshStandardMaterial color={c} roughness={0.85} />
      </mesh>
      <mesh position={[-0.45, 2.55, -0.15]} castShadow>
        <sphereGeometry args={[0.66, 16, 12]} />
        <meshStandardMaterial color={c} roughness={0.85} />
      </mesh>
    </group>
  );
}

export function Bush({ color = '#6aa86f', flowers = true }: { color?: string; flowers?: boolean }) {
  return (
    <group>
      {[[0, 0.38, 0, 0.5], [0.45, 0.28, 0.1, 0.36], [-0.42, 0.26, -0.05, 0.34]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
      {flowers && [[0.1, 0.8, 0.25], [-0.3, 0.55, 0.25], [0.5, 0.55, 0.3]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshStandardMaterial color={i % 2 ? '#ffd166' : '#ff9fb2'} />
        </mesh>
      ))}
    </group>
  );
}

/** Street lamp with emissive bulb, small point light and a warm light pool on the ground. */
export function Lamp({ color = '#ffd28f', withLight = true }: { color?: string; withLight?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.2, 10]} />
        <meshStandardMaterial color="#3c3f58" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 2.7, 8]} />
        <meshStandardMaterial color="#3c3f58" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.82, 0]} castShadow>
        <coneGeometry args={[0.28, 0.24, 14]} />
        <meshStandardMaterial color="#3c3f58" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.62, 0]}>
        <sphereGeometry args={[0.15, 14, 12]} />
        <meshStandardMaterial color="#fff6dc" emissive={color} emissiveIntensity={7} toneMapped={false} />
      </mesh>
      {withLight && <pointLight position={[0, 2.4, 0]} color={color} intensity={9} distance={7} decay={1.8} />}
      <mesh rotation-x={-Math.PI / 2} position-y={0.08}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshBasicMaterial map={getGlowTexture()} color={color} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/** Toy car facing +Z, parked on its own little pad. */
export function Car({ color = '#e07a5f' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.0, 0.03, 3.1]} />
        <meshStandardMaterial color="#4a4f6b" roughness={0.9} />
      </mesh>
      {[-0.98, 0.98].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.06, 0.01, 3.0]} />
          <meshStandardMaterial color="#f4f1fb" />
        </mesh>
      ))}
      <RoundedBox args={[1.25, 0.55, 2.3]} radius={0.2} smoothness={3} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[1.1, 0.48, 1.25]} radius={0.16} smoothness={3} position={[0, 0.92, -0.15]} castShadow>
        <meshStandardMaterial color="#2c3150" roughness={0.15} metalness={0.3} />
      </RoundedBox>
      <RoundedBox args={[1.14, 0.1, 1.05]} radius={0.05} position={[0, 1.15, -0.15]} castShadow>
        <meshStandardMaterial color={color} roughness={0.45} />
      </RoundedBox>
      {[[-0.6, 0.72], [0.6, 0.72], [-0.6, -0.72], [0.6, -0.72]].map(([x, z], i) => (
        <Wheel key={i} position={[x, 0.26, z]} r={0.25} width={0.18} />
      ))}
      {[-0.4, 0.4].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.55, 1.16]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#fffbe6" emissive="#fff1c1" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          <mesh position={[x, 0.55, -1.16]}>
            <boxGeometry args={[0.22, 0.08, 0.04]} />
            <meshStandardMaterial color="#ff5e6c" emissive="#ff3b55" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Bench({ color = '#c08b5c' }: { color?: string }) {
  return (
    <group>
      {[-0.12, 0.12].map((z) => (
        <RoundedBox key={z} args={[1.6, 0.07, 0.2]} radius={0.03} position={[0, 0.45, z]} castShadow>
          <meshStandardMaterial color={color} roughness={0.8} />
        </RoundedBox>
      ))}
      <RoundedBox args={[1.6, 0.25, 0.06]} radius={0.03} position={[0, 0.75, -0.25]} rotation-x={-0.15} castShadow>
        <meshStandardMaterial color={color} roughness={0.8} />
      </RoundedBox>
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.3, -0.05]} castShadow>
          <boxGeometry args={[0.07, 0.6, 0.5]} />
          <meshStandardMaterial color="#3c3f58" />
        </mesh>
      ))}
    </group>
  );
}

export function Mailbox({ color = '#5b7bd5' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.1, 0.9, 0.1]} />
        <meshStandardMaterial color="#8a6a5c" />
      </mesh>
      <RoundedBox args={[0.34, 0.32, 0.55]} radius={0.12} smoothness={3} position={[0, 1.02, 0]} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0.2, 1.18, -0.08]} castShadow>
        <boxGeometry args={[0.03, 0.26, 0.05]} />
        <meshStandardMaterial color="#ef476f" />
      </mesh>
      <mesh position={[0.2, 1.26, -0.0]} castShadow>
        <boxGeometry args={[0.03, 0.1, 0.16]} />
        <meshStandardMaterial color="#ef476f" />
      </mesh>
    </group>
  );
}
