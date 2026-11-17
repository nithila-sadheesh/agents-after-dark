import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { HOME_ANCHOR, ROAD_Z, SHOP_ANCHOR } from '../../../shared/world';
import { hash2, onSelect } from '../worldState';

export const GROUND_SIZE: [number, number] = [52, 30];
export const GROUND_CENTER_Z = 0.5;

/** Miniature diorama plinth: grass top over layered soil. Clicking it clears the selection. */
export default function Ground() {
  const [w, d] = GROUND_SIZE;
  return (
    <group position={[0, 0, GROUND_CENTER_Z]}>
      <RoundedBox args={[w, 0.6, d]} radius={0.28} smoothness={4} position={[0, -0.3, 0]} receiveShadow onClick={onSelect(null)}>
        <meshStandardMaterial color="#84cc8c" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[w - 0.5, 1.5, d - 0.5]} radius={0.3} position={[0, -1.25, 0]}>
        <meshStandardMaterial color="#8a6552" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[w - 1.1, 1.1, d - 1.1]} radius={0.3} position={[0, -2.35, 0]}>
        <meshStandardMaterial color="#5c4466" roughness={1} />
      </RoundedBox>
      <Tufts />
    </group>
  );
}

/** Deterministically scattered grass tufts and flowers, kept off the road, plaza and buildings. */
function Tufts() {
  const tufts = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    const [w, d] = GROUND_SIZE;
    for (let i = 0; out.length < 70 && i < 2000; i++) {
      const x = (hash2(i, 1.7) - 0.5) * (w - 2);
      const z = (hash2(3.1, i) - 0.5) * (d - 2) + GROUND_CENTER_Z;
      if (Math.abs(z - ROAD_Z) < 2.8) continue;
      if (Math.abs(x - HOME_ANCHOR[0]) < 4.4 && z > -7 && z < 1.2) continue;
      if (Math.abs(x - SHOP_ANCHOR[0]) < 4.6 && z > -7 && z < 1.6) continue;
      if (Math.abs(x - -6.5) < 1.4 && z > -3 && z < 1.6) continue;
      out.push([x, z, hash2(i, i * 0.37)]);
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    spots.forEach(([x, z, r], i) => {
      m.position.set(x, 0, z - GROUND_CENTER_Z);
      m.scale.set(0.35 + r * 0.45, 0.25 + r * 0.3, 0.35 + r * 0.45);
      m.rotation.set(0, r * 6, 0);
      m.updateMatrix();
      tufts.current?.setMatrixAt(i, m.matrix);
      m.position.set(x + 0.15, 0.14 + r * 0.06, z - GROUND_CENTER_Z + 0.08);
      m.scale.setScalar(r > 0.55 ? 1 : 0);
      m.updateMatrix();
      flowers.current?.setMatrixAt(i, m.matrix);
      flowers.current?.setColorAt(i, new THREE.Color(r > 0.8 ? '#ffd166' : r > 0.68 ? '#ff9fb2' : '#ffffff'));
    });
    if (tufts.current) tufts.current.instanceMatrix.needsUpdate = true;
    if (flowers.current) {
      flowers.current.instanceMatrix.needsUpdate = true;
      if (flowers.current.instanceColor) flowers.current.instanceColor.needsUpdate = true;
    }
  }, [spots]);

  return (
    <>
      <instancedMesh ref={tufts} args={[undefined, undefined, spots.length]} castShadow>
        <sphereGeometry args={[0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#79c583" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, spots.length]}>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </>
  );
}
