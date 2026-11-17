// CityLife (OWNER: life). Minimal static pass: street trees on the curb side of sidewalks and parked cars in the
// parking lanes, plus moving <Traffic /> and walking <Pedestrians />.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY_BOUNDS, STREETS_X, STREETS_Z } from '../../../shared/world';
import Traffic from './Traffic';
import Pedestrians from './Pedestrians';

const SIDEWALK_TOP = 0.15;
const TREE_OFF = 5.5;   // trunk distance from street centerline (keeps robot corridor at 6.5±0.8 clear)
const PARK_OFF = 4.05;  // parked-car center distance from street centerline

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const nearIntersection = (v: number, lines: readonly number[], d: number) => lines.some((s) => Math.abs(v - s) < d);

type Spot = { x: number; z: number; rot: number };
function spotsAlong(off: number, step: number, clear: number, r: () => number, skip: (x: number, z: number) => boolean) {
  const out: Spot[] = [];
  for (const z of STREETS_Z) for (const side of [-1, 1]) {
    for (let x = CITY_BOUNDS.minX + 4; x < CITY_BOUNDS.maxX - 4; x += step + r() * 2) {
      const zz = z + side * off;
      if (!nearIntersection(x, STREETS_X, clear) && !skip(x, zz) && r() > 0.15) out.push({ x, z: zz, rot: Math.PI / 2 });
    }
  }
  for (const x of STREETS_X) for (const side of [-1, 1]) {
    for (let z = CITY_BOUNDS.minZ + 4; z < CITY_BOUNDS.maxZ - 4; z += step + r() * 2) {
      const xx = x + side * off;
      if (!nearIntersection(z, STREETS_Z, clear) && !skip(xx, z) && r() > 0.15) out.push({ x: xx, z, rot: 0 });
    }
  }
  return out;
}

// Keep the home door (x≈-40, z≈-5.5) and the shop door (x≈0, z≈34.5) frontages clear.
const nearDoors = (x: number, z: number) => (Math.abs(x + 40) < 6 && Math.abs(z + 5) < 2) || (Math.abs(x) < 10 && Math.abs(z - 35) < 2);

const CAR_COLORS = ['#1d2430', '#e8e8e6', '#9aa1a8', '#5a0f14', '#203a5c', '#2b2b2b', '#c9c3b5', '#f2c21b', '#3e4a3d'];

export default function CityLife() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const cabins = useRef<THREE.InstancedMesh>(null);
  const { trees, cars } = useMemo(() => {
    const r = rng(7);
    return {
      trees: spotsAlong(TREE_OFF, 9, 10, r, nearDoors),
      cars: spotsAlong(PARK_OFF, 6, 12, r, nearDoors),
    };
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const r = rng(11);
    trees.forEach((t, i) => {
      const h = 6 + r() * 4;
      trunks.current!.setMatrixAt(i, m.compose(p.set(t.x, SIDEWALK_TOP + h * 0.25, t.z), q.identity(), s.set(1, h * 0.5, 1)));
      crowns.current!.setMatrixAt(i, m.compose(p.set(t.x, SIDEWALK_TOP + h * 0.68, t.z), q.setFromAxisAngle(up, r() * 6), s.set(2.6 + r(), h * 0.32, 2.6 + r())));
      crowns.current!.setColorAt(i, c.setHSL(0.24 + r() * 0.06, 0.45, 0.22 + r() * 0.08));
    });
    cars.forEach((k, i) => {
      q.setFromAxisAngle(up, k.rot + (r() - 0.5) * 0.03);
      bodies.current!.setMatrixAt(i, m.compose(p.set(k.x, 0.55, k.z), q, s.set(1, 1, 1)));
      cabins.current!.setMatrixAt(i, m.compose(p.set(k.x, 1.15, k.z), q, s.set(1, 1, 1)));
      bodies.current!.setColorAt(i, c.set(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]));
    });
    for (const im of [trunks.current!, crowns.current!, bodies.current!, cabins.current!]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [trees, cars]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1, 8]} />
        <meshStandardMaterial color="#6b5f52" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, cars.length]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.75, 4.5]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.35} metalness={0.4} clearcoat={1} clearcoatRoughness={0.08} />
      </instancedMesh>
      <instancedMesh ref={cabins} args={[undefined, undefined, cars.length]} castShadow>
        <boxGeometry args={[1.6, 0.5, 2.3]} />
        <meshPhysicalMaterial color="#1a2129" roughness={0.08} metalness={0.2} clearcoat={1} />
      </instancedMesh>
      <Traffic />
      <Pedestrians />
    </group>
  );
}
