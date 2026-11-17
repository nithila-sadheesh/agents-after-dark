// Pedestrians (OWNER: life). Instanced walkers on the building side of every sidewalk (7.6m from street centerlines,
// clear of the robot's 6.5m corridor), pacing their block face and turning back at the ends; a few idle groups by
// the shop. They pause when the robot comes within 2.5m. One useFrame, no per-frame allocations.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_BOUNDS, STREETS_X, STREETS_Z } from '../../../shared/world';
import { SIDEWALK_TOP } from '../city/roads/layout';
import { robotPose } from '../../store';

const OFF = 7.6;
const END = 8.5;  // keep off the cross street (turn back before the corner)
const WALKERS = 80;
const GROUP: [number, number, number][] = [ // x, z, facing
  [-10.4, 34.5, 1.2], [-9.5, 34.7, -1.9], [-6.2, 34.4, 0.6], [-5.5, 34.8, -2.4], [-4.9, 34.3, -0.9],
  [5.6, 34.5, 1.7], [6.4, 34.8, -1.5], [9.8, 34.4, 0.3], [10.5, 34.7, -2.8],
];
const N = WALKERS + GROUP.length;

type Seg = { axis: 'x' | 'z'; c: number; a: number; b: number };
const SEGS: Seg[] = [];
for (const z of STREETS_Z) for (const side of [-1, 1]) {
  const pts = [CITY_BOUNDS.minX, ...STREETS_X, CITY_BOUNDS.maxX];
  for (let i = 0; i < pts.length - 1; i++) SEGS.push({ axis: 'x', c: z + side * OFF, a: pts[i] + (i ? END : 2), b: pts[i + 1] - (i < pts.length - 2 ? END : 2) });
}
for (const x of STREETS_X) for (const side of [-1, 1]) {
  const pts = [CITY_BOUNDS.minZ, ...STREETS_Z, CITY_BOUNDS.maxZ];
  for (let i = 0; i < pts.length - 1; i++) SEGS.push({ axis: 'z', c: x + side * OFF, a: pts[i] + (i ? END : 2), b: pts[i + 1] - (i < pts.length - 2 ? END : 2) });
}

type Ped = { seg: number; s: number; dir: number; speed: number; phase: number; scale: number; idle: boolean; x: number; z: number; yaw: number };

const SKIN = ['#f1d3bc', '#e0b493', '#c68c63', '#a86b45', '#7a4a2d', '#563220', '#f5dcc8'];
const SHIRT = ['#1f2a44', '#c0392b', '#ecf0f1', '#2c3e50', '#16a085', '#e67e22', '#8e44ad', '#f1c40f', '#7f8c8d', '#d35400', '#2d572c', '#b7a07a', '#111111', '#3a6ea5', '#e84393'];
const PANTS = ['#1b2433', '#2f3640', '#3b3b3b', '#5a4a3a', '#22313f', '#c8bfae', '#111111', '#4b5d73'];

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export default function Pedestrians() {
  const torso = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);

  const peds = useMemo<Ped[]>(() => {
    const r = rng(41);
    const out: Ped[] = [];
    for (let i = 0; i < WALKERS; i++) {
      const seg = Math.floor(r() * SEGS.length), S = SEGS[seg];
      out.push({ seg, s: S.a + r() * (S.b - S.a), dir: r() < 0.5 ? 1 : -1, speed: 1.2 + r() * 0.3, phase: r() * 6.28, scale: 0.93 + r() * 0.12, idle: false, x: 0, z: 0, yaw: 0 });
    }
    for (const [x, z, yaw] of GROUP) out.push({ seg: 0, s: 0, dir: 1, speed: 0, phase: r() * 6.28, scale: 0.93 + r() * 0.12, idle: true, x, z, yaw });
    return out;
  }, []);

  const geo = useMemo(() => {
    const leg = new THREE.BoxGeometry(0.15, 0.82, 0.17); leg.translate(0, -0.41, 0);
    const arm = new THREE.BoxGeometry(0.1, 0.64, 0.11); arm.translate(0, -0.32, 0);
    return { leg, arm };
  }, []);

  const scratch = useMemo(() => ({
    base: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(),
    q: new THREE.Quaternion(), ql: new THREE.Quaternion(), qi: new THREE.Quaternion(),
    p: new THREE.Vector3(), s: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1),
    up: new THREE.Vector3(0, 1, 0), xa: new THREE.Vector3(1, 0, 0),
  }), []);

  useLayoutEffect(() => {
    const r = rng(9), c = new THREE.Color();
    peds.forEach((_, i) => {
      const shirt = SHIRT[Math.floor(r() * SHIRT.length)];
      torso.current!.setColorAt(i, c.set(shirt));
      head.current!.setColorAt(i, c.set(SKIN[Math.floor(r() * SKIN.length)]));
      const pants = PANTS[Math.floor(r() * PANTS.length)];
      legs.current!.setColorAt(i * 2, c.set(pants)); legs.current!.setColorAt(i * 2 + 1, c);
      const sleeve = r() < 0.4 ? SKIN[Math.floor(r() * SKIN.length)] : shirt;
      arms.current!.setColorAt(i * 2, c.set(sleeve)); arms.current!.setColorAt(i * 2 + 1, c);
    });
    for (const im of [torso.current!, head.current!, legs.current!, arms.current!]) im.instanceColor!.needsUpdate = true;
  }, [peds]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { base, local, out, q, ql, qi, p, s, one, up, xa } = scratch;
    const rx = robotPose.position[0], rz = robotPose.position[2];
    for (let i = 0; i < peds.length; i++) {
      const k = peds[i];
      let swing = 0, bob = 0;
      if (!k.idle) {
        const S = SEGS[k.seg];
        const paused = (k.x - rx) ** 2 + (k.z - rz) ** 2 < 2.5 * 2.5;
        if (!paused) {
          k.s += k.speed * k.dir * dt;
          if (k.s > S.b) { k.s = S.b; k.dir = -1; } else if (k.s < S.a) { k.s = S.a; k.dir = 1; }
          k.phase += k.speed * dt * 4.6;
          swing = Math.sin(k.phase);
          bob = Math.abs(Math.cos(k.phase)) * 0.035;
        }
        k.x = S.axis === 'x' ? k.s : S.c; k.z = S.axis === 'x' ? S.c : k.s;
        k.yaw = S.axis === 'x' ? (k.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : k.dir > 0 ? 0 : Math.PI;
      } else {
        k.phase += dt * 0.8;
        swing = Math.sin(k.phase) * 0.06; // idle sway of arms
      }
      base.compose(p.set(k.x, SIDEWALK_TOP + bob, k.z), q.setFromAxisAngle(up, k.yaw), s.set(k.scale, k.scale, k.scale));

      local.compose(p.set(0, 1.18, 0), qi, s.set(1.12, 1, 0.72));
      torso.current!.setMatrixAt(i, out.multiplyMatrices(base, local));
      local.compose(p.set(0, 1.6, 0.01), qi, one);
      head.current!.setMatrixAt(i, out.multiplyMatrices(base, local));
      for (let side = 0; side < 2; side++) {
        const sg = side ? 1 : -1;
        local.compose(p.set(sg * 0.1, 0.84, 0), ql.setFromAxisAngle(xa, sg * swing * 0.5), one);
        legs.current!.setMatrixAt(i * 2 + side, out.multiplyMatrices(base, local));
        local.compose(p.set(sg * 0.26, 1.44, 0), ql.setFromAxisAngle(xa, -sg * swing * 0.45), one);
        arms.current!.setMatrixAt(i * 2 + side, out.multiplyMatrices(base, local));
      }
    }
    for (const im of [torso.current!, head.current!, legs.current!, arms.current!]) im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={torso} args={[undefined, undefined, N]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.18, 0.36, 4, 10]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, N]} castShadow frustumCulled={false}>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={legs} args={[geo.leg, undefined, N * 2]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[geo.arm, undefined, N * 2]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
