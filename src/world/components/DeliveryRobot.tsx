import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { useFoStore } from '../../store';
import type { Vec3 } from '../../../shared/types';

const WHEEL_R = 0.2;
const WHEELS: Vec3[] = [-0.46, 0, 0.46].flatMap((z) => [[-0.57, WHEEL_R, z], [0.57, WHEEL_R, z]] as Vec3[]);
const BODY = '#f7f5ff';
const BASKET = '#ffb38a';

/** Cute six-wheeled delivery buggy facing +Z. Wheels spin with actual travel; body bobs while `robot.moving`.
 *  `cargoRef` receives an anchor at the floor of the cargo basket. */
export default function DeliveryRobot({ accent = '#7c9cff', cargoRef }: {
  accent?: string; cargoRef?: (o: THREE.Object3D | null) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const eyes = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const flag = useRef<THREE.Group>(null);
  const st = useRef({ last: new THREE.Vector3(), dist: 0, init: false, moveBlend: 0 });
  const tmp = useRef(new THREE.Vector3());

  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    const s = st.current;
    const t = clock.elapsedTime;
    const p = root.current.getWorldPosition(tmp.current);
    if (!s.init) { s.last.copy(p); s.init = true; }
    const step = p.distanceTo(s.last);
    s.last.copy(p);
    if (step < 1) s.dist += step;
    for (const w of wheels.current) if (w) w.rotation.x = s.dist / WHEEL_R;

    const moving = useFoStore.getState().robot.moving;
    s.moveBlend += ((moving ? 1 : 0) - s.moveBlend) * Math.min(1, dt * 6);
    if (body.current) {
      body.current.position.y = Math.sin(t * 15) * 0.025 * s.moveBlend + Math.sin(t * 2) * 0.008;
      body.current.rotation.x = -0.04 * s.moveBlend + Math.sin(t * 7.5) * 0.012 * s.moveBlend;
    }
    if (eyes.current) {
      const blink = (t % 3.6) < 0.12 ? 0.15 : 1;
      eyes.current.scale.y = blink;
    }
    if (beacon.current) beacon.current.emissiveIntensity = 2 + 3 * (0.5 + 0.5 * Math.sin(t * 5));
    if (flag.current) flag.current.rotation.y = Math.sin(t * 6) * (0.15 + 0.35 * s.moveBlend);
  });

  return (
    <group ref={root}>
      {WHEELS.map((pos, i) => (
        <group key={i} position={pos} ref={(g) => { wheels.current[i] = g; }}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.15, 18]} />
            <meshStandardMaterial color="#2b2d42" roughness={0.85} />
          </mesh>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.1, 0.1, 0.17, 6]} />
            <meshStandardMaterial color={accent} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <group ref={body}>
        {/* chassis */}
        <RoundedBox args={[1.02, 0.36, 1.36]} radius={0.14} smoothness={3} position={[0, 0.4, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#c9c6dd" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[1.0, 0.3, 1.34]} radius={0.14} smoothness={3} position={[0, 0.62, 0]} castShadow>
          <meshStandardMaterial color={BODY} roughness={0.45} />
        </RoundedBox>
        {/* accent stripes */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.506, 0.5, 0]}>
            <boxGeometry args={[0.01, 0.06, 1.0]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
          </mesh>
        ))}
        {/* face */}
        <RoundedBox args={[0.72, 0.3, 0.06]} radius={0.06} position={[0, 0.58, 0.67]}>
          <meshStandardMaterial color="#1b1e33" roughness={0.25} />
        </RoundedBox>
        <group ref={eyes} position={[0, 0.59, 0.705]}>
          {[-0.15, 0.15].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <circleGeometry args={[0.065, 20]} />
              <meshStandardMaterial color="#8ff6ff" emissive="#7ff3ff" emissiveIntensity={4} toneMapped={false} />
            </mesh>
          ))}
        </group>
        {/* headlights + taillights */}
        {[-0.38, 0.38].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.36, 0.67]}>
              <sphereGeometry args={[0.055, 10, 8]} />
              <meshStandardMaterial color="#ffffff" emissive="#fff6d8" emissiveIntensity={4} toneMapped={false} />
            </mesh>
            <mesh position={[x, 0.42, -0.69]}>
              <boxGeometry args={[0.16, 0.05, 0.02]} />
              <meshStandardMaterial color="#ff5e6c" emissive="#ff3b55" emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* open cargo basket */}
        <group position={[0, 0.77, -0.1]}>
          <RoundedBox args={[0.9, 0.05, 0.98]} radius={0.02}>
            <meshStandardMaterial color={BASKET} roughness={0.7} />
          </RoundedBox>
          {[-1, 1].map((s) => (
            <group key={s}>
              <RoundedBox args={[0.06, 0.3, 0.98]} radius={0.025} position={[s * 0.42, 0.15, 0]} castShadow>
                <meshStandardMaterial color={BASKET} roughness={0.7} />
              </RoundedBox>
              <RoundedBox args={[0.9, 0.3, 0.06]} radius={0.025} position={[0, 0.15, s * 0.46]} castShadow>
                <meshStandardMaterial color={BASKET} roughness={0.7} />
              </RoundedBox>
            </group>
          ))}
          <group ref={cargoRef} position={[0, 0.03, 0]} />
        </group>
        {/* antenna, flag and beacon */}
        <group position={[0.36, 0.77, -0.6]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 1.0, 6]} />
            <meshStandardMaterial color="#3c3f58" />
          </mesh>
          <group ref={flag} position={[0, 0.88, 0]}>
            <mesh position={[0, 0, -0.15]}>
              <boxGeometry args={[0.012, 0.18, 0.28]} />
              <meshStandardMaterial color="#ff7b54" roughness={0.7} />
            </mesh>
          </group>
          <mesh position={[0, 1.04, 0]}>
            <sphereGeometry args={[0.055, 12, 10]} />
            <meshStandardMaterial ref={beacon} color={accent} emissive={accent} emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
