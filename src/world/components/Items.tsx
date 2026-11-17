import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox, Sparkles } from '@react-three/drei';

/** Rounded sack with a tie at the top. Origin at the bottom center. */
export function LaundryBag({ clean = false }: { clean?: boolean }) {
  const sack = useMemo(() => {
    const pts = [
      [0, 0], [0.2, 0.01], [0.3, 0.07], [0.35, 0.18], [0.36, 0.3], [0.32, 0.42],
      [0.22, 0.52], [0.11, 0.58], [0.075, 0.61],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  const top = useMemo(() => {
    const pts = [[0.06, 0.6], [0.1, 0.66], [0.16, 0.73], [0.14, 0.76], [0.05, 0.72], [0, 0.71]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 16);
  }, []);
  const body = clean ? '#f4f8ff' : '#b8ab95';
  const tie = clean ? '#6fb8ff' : '#7d6f5e';

  return (
    <group>
      <mesh geometry={sack} castShadow receiveShadow scale={[1, 1, 0.9]}>
        <meshStandardMaterial color={body} roughness={clean ? 0.45 : 0.95} emissive={clean ? '#cfe6ff' : '#000000'} emissiveIntensity={clean ? 0.25 : 0} />
      </mesh>
      <mesh geometry={top} castShadow>
        <meshStandardMaterial color={body} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.615, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.08, 0.028, 8, 20]} />
        <meshStandardMaterial color={tie} emissive={clean ? tie : '#000000'} emissiveIntensity={clean ? 1.6 : 0} toneMapped={!clean} />
      </mesh>
      {clean ? (
        <Sparkles count={14} scale={[0.9, 0.9, 0.9]} position={[0, 0.45, 0]} size={3.5} speed={0.6} color="#cfe9ff" noise={0.4} />
      ) : (
        // a little patch to read as "dirty"
        <mesh position={[0.17, 0.26, 0.29]} rotation-y={0.5}>
          <circleGeometry args={[0.07, 12]} />
          <meshStandardMaterial color="#8f8270" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

/** Cardboard box with packing tape. Origin at the bottom center. */
export function PackageBox({ clean = false }: { clean?: boolean }) {
  return (
    <group>
      <RoundedBox args={[0.62, 0.46, 0.52]} radius={0.03} smoothness={2} position={[0, 0.23, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c99a6b" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.462, 0]}>
        <boxGeometry args={[0.64, 0.01, 0.12]} />
        <meshStandardMaterial color="#ead9b4" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.23, 0.262]}>
        <boxGeometry args={[0.12, 0.47, 0.01]} />
        <meshStandardMaterial color="#ead9b4" roughness={0.5} />
      </mesh>
      <mesh position={[-0.18, 0.28, 0.263]}>
        <planeGeometry args={[0.16, 0.11]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {clean && <Sparkles count={10} scale={[0.9, 0.8, 0.9]} position={[0, 0.4, 0]} size={3} speed={0.5} color="#ffe2b0" />}
    </group>
  );
}
