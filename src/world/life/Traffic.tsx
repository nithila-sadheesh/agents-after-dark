// Traffic (OWNER: life). Instanced moving cars driving straight along every street lane, obeying the shared signal
// clock, keeping following distance and yielding to the delivery robot. One useFrame, no per-frame allocations.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_BOUNDS, STREETS_X, STREETS_Z } from '../../../shared/world';
import { signalFor } from '../signals';
import { robotPose } from '../../store';

const LANE = 2.2;
const STOP = 8.5;        // stop line distance before intersection center
const VMAX = 9;
const ACCEL = 3;
const DECEL = 7;
const FOLLOW = 7;
const WHEEL_R = 0.34;

type Lane = { axis: 'x' | 'z'; c: number; dir: 1 | -1; min: number; max: number; cross: readonly number[] };
type Car = { lane: number; s: number; v: number; len: number; wid: number; hgt: number; bus: boolean; spin: number; vmax: number };

const LANES: Lane[] = [
  ...STREETS_Z.flatMap((z) => [
    { axis: 'x' as const, c: z + LANE, dir: 1 as const, min: CITY_BOUNDS.minX, max: CITY_BOUNDS.maxX, cross: STREETS_X },
    { axis: 'x' as const, c: z - LANE, dir: -1 as const, min: CITY_BOUNDS.minX, max: CITY_BOUNDS.maxX, cross: STREETS_X },
  ]),
  ...STREETS_X.flatMap((x) => [
    { axis: 'z' as const, c: x - LANE, dir: 1 as const, min: CITY_BOUNDS.minZ, max: CITY_BOUNDS.maxZ, cross: STREETS_Z },
    { axis: 'z' as const, c: x + LANE, dir: -1 as const, min: CITY_BOUNDS.minZ, max: CITY_BOUNDS.maxZ, cross: STREETS_Z },
  ]),
];

const PAINT = ['#1c1f24', '#f1f1ef', '#b9bec4', '#7c828a', '#6e0d16', '#1f3b66', '#2c2c2e', '#d8d2c4', '#3d4b3c', '#a33a1c', '#0f5e7a', '#e5e4e0', '#41464d', '#8a1c1c'];
const TAXI = '#f4c20d';
const N = 36;

function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export default function Traffic() {
  const body = useRef<THREE.InstancedMesh>(null);
  const cabin = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const tails = useRef<THREE.InstancedMesh>(null);

  const cars = useMemo<Car[]>(() => {
    const r = rng(23);
    const out: Car[] = [];
    for (let i = 0; i < N; i++) {
      const lane = i % LANES.length;
      const L = LANES[lane];
      const k = Math.floor(i / LANES.length);
      const span = L.max - L.min;
      const s = L.min + ((k / 3 + r() * 0.12 + lane * 0.07) % 1) * span;
      const bus = i === 5;
      out.push({ lane, s, v: 5, len: bus ? 11 : 4.3 + r() * 0.5, wid: bus ? 2.5 : 1.8 + r() * 0.1, hgt: bus ? 2.7 : 0.7 + r() * 0.15, bus, spin: 0, vmax: VMAX * (0.8 + r() * 0.2) });
    }
    return out;
  }, []);

  const scratch = useMemo(() => ({
    base: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(),
    q: new THREE.Quaternion(), qi: new THREE.Quaternion(), qw: new THREE.Quaternion(),
    p: new THREE.Vector3(), s: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1),
    up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler(),
  }), []);

  useLayoutEffect(() => {
    const r = rng(5), c = new THREE.Color();
    cars.forEach((k, i) => {
      const col = k.bus ? '#c8372d' : i % 9 === 3 ? TAXI : PAINT[Math.floor(r() * PAINT.length)];
      body.current!.setColorAt(i, c.set(col));
    });
    body.current!.instanceColor!.needsUpdate = true;
  }, [cars]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { base, local, out, q, qi, qw, p, s, one, up, e } = scratch;
    const ew = signalFor('EW'), ns = signalFor('NS');
    const rp = robotPose.position;

    // 1) speeds
    for (let i = 0; i < cars.length; i++) {
      const k = cars[i], L = LANES[k.lane], span = L.max - L.min;
      let gap = 1e9;
      // car ahead
      for (let j = 0; j < cars.length; j++) {
        if (j === i || cars[j].lane !== k.lane) continue;
        const d = ((((cars[j].s - k.s) * L.dir) % span) + span) % span;
        const need = Math.max(FOLLOW, (k.len + cars[j].len) / 2 + 2.5);
        if (d - need < gap) gap = d - need;
      }
      // signals
      const light = L.axis === 'x' ? ew : ns;
      if (light !== 'green') {
        for (const x of L.cross) {
          const d = (x - k.s) * L.dir - STOP - k.len / 2; // front bumper to stop line
          if (d < 0 || d > 60) continue;
          // yellow: keep going if we can't stop comfortably
          if (light === 'yellow' && d < (k.v * k.v) / (2 * DECEL)) continue;
          if (d - 0.5 < gap) gap = d - 0.5;
        }
      }
      // robot yield
      const lat = L.axis === 'x' ? rp[2] - L.c : rp[0] - L.c;
      if (Math.abs(lat) < 3.5) {
        const ahead = ((L.axis === 'x' ? rp[0] : rp[2]) - k.s) * L.dir;
        if (ahead > 0 && ahead < 12) { const g = ahead - k.len / 2 - 1.5; if (g < gap) gap = g; }
      }
      const target = gap <= 0 ? 0 : Math.min(k.vmax, Math.sqrt(2 * DECEL * 0.6 * gap));
      if (target > k.v) k.v = Math.min(target, k.v + ACCEL * dt);
      else k.v = Math.max(target, k.v - DECEL * 1.6 * dt);
      if (gap <= 0) k.v = 0;
    }

    // 2) integrate + matrices
    for (let i = 0; i < cars.length; i++) {
      const k = cars[i], L = LANES[k.lane], span = L.max - L.min;
      k.s += k.v * dt * L.dir;
      if (k.s > L.max) k.s -= span; else if (k.s < L.min) k.s += span;
      k.spin -= (k.v * dt) / WHEEL_R;
      const x = L.axis === 'x' ? k.s : L.c, z = L.axis === 'x' ? L.c : k.s;
      const yaw = L.axis === 'x' ? (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : L.dir > 0 ? 0 : Math.PI;
      base.compose(p.set(x, 0, z), q.setFromAxisAngle(up, yaw), one);
      const hl = k.len / 2, hw = k.wid / 2, bot = WHEEL_R * 0.85;

      local.compose(p.set(0, bot + k.hgt / 2, 0), qi, s.set(k.wid, k.hgt, k.len));
      body.current!.setMatrixAt(i, out.multiplyMatrices(base, local));
      if (k.bus) local.compose(p.set(0, bot + k.hgt * 0.68, 0.2), qi, s.set(k.wid + 0.04, k.hgt * 0.32, k.len - 1.2));
      else local.compose(p.set(0, bot + k.hgt + 0.29, -0.25), qi, s.set(k.wid * 0.88, 0.58, k.len * 0.5));
      cabin.current!.setMatrixAt(i, out.multiplyMatrices(base, local));

      qw.setFromEuler(e.set(k.spin, 0, Math.PI / 2));
      const wx = hw - 0.08, wz = hl - (k.bus ? 2 : 0.85);
      for (let w = 0; w < 4; w++) {
        local.compose(p.set(w & 1 ? wx : -wx, WHEEL_R, w & 2 ? wz : -wz), qw, s.set(k.bus ? 1.3 : 1, 1, k.bus ? 1.3 : 1));
        wheels.current!.setMatrixAt(i * 4 + w, out.multiplyMatrices(base, local));
      }
      for (let side = 0; side < 2; side++) {
        const lx = (side ? 1 : -1) * (hw - 0.3);
        local.compose(p.set(lx, bot + k.hgt * (k.bus ? 0.2 : 0.62), hl + 0.01), qi, s.set(0.36, 0.13, 0.04));
        heads.current!.setMatrixAt(i * 2 + side, out.multiplyMatrices(base, local));
        local.compose(p.set(lx, bot + k.hgt * (k.bus ? 0.2 : 0.7), -hl - 0.01), qi, s.set(0.32, 0.12, 0.04));
        tails.current!.setMatrixAt(i * 2 + side, out.multiplyMatrices(base, local));
      }
    }
    for (const im of [body.current!, cabin.current!, wheels.current!, heads.current!, tails.current!]) im.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, N]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.28} metalness={0.55} envMapIntensity={1.2} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, N]} castShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#141a22" roughness={0.08} metalness={0.9} />
      </instancedMesh>
      <instancedMesh ref={wheels} args={[undefined, undefined, N * 4]} frustumCulled={false}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.26, 12]} />
        <meshStandardMaterial color="#121212" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff6e0" emissiveIntensity={2.5} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tails} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ff2a1a" emissive="#ff1a0a" emissiveIntensity={2} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
