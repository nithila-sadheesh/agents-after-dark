// Street furniture (OWNER: roads): traffic signals at every intersection, street lamps, hydrants, trash cans.
// Everything is instanced: ~16 draw calls total. Only poles cast shadows.
import * as THREE from 'three';
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { INTERSECTIONS } from '../../../../shared/world';
import { signalFor } from '../../signals';
import { CURB_ZONE, RUNS, SIDEWALK_TOP, clearOfRoute, onRun, rng } from './layout';

const tmp = new THREE.Object3D();
type M = THREE.Matrix4;
const mat = (x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1): M => {
  tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
  return tmp.matrix.clone();
};
function inst(geo: THREE.BufferGeometry, material: THREE.Material, ms: M[], shadow = false) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(ms.length, 1));
  ms.forEach((x, i) => m.setMatrixAt(i, x));
  m.count = ms.length; m.castShadow = shadow; m.receiveShadow = !shadow;
  m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  return m;
}

const COLORS = { red: '#ff2a1a', yellow: '#ffb000', green: '#19ff6a' } as const;
type Lamp = keyof typeof COLORS;
const LAMPS: Lamp[] = ['red', 'yellow', 'green'];

function build() {
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3d40', metalness: 0.6, roughness: 0.45 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#111213', roughness: 0.6 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);

  // ---- Traffic signals: one far-side mast arm per approach (right-hand traffic) ----
  // corner (sx,sz), arm axis, head facing (toward oncoming traffic), signal axis
  const APPROACH: { sx: number; sz: number; arm: 'x' | 'z'; face: [number, number]; axis: 'EW' | 'NS' }[] = [
    { sx: 1, sz: 1, arm: 'z', face: [-1, 0], axis: 'EW' },   // +X traffic, lane z=+2.6
    { sx: -1, sz: -1, arm: 'z', face: [1, 0], axis: 'EW' },  // -X traffic, lane z=-2.6
    { sx: -1, sz: 1, arm: 'x', face: [0, -1], axis: 'NS' },  // +Z traffic, lane x=-2.6
    { sx: 1, sz: -1, arm: 'x', face: [0, 1], axis: 'NS' },   // -Z traffic, lane x=+2.6
  ];
  const C = 6.0, POLE_H = 5, ARM_Y = 4.75;
  const poles: M[] = [], arms: M[] = [], heads: M[] = [];
  const lampM: Record<'EW' | 'NS', Record<Lamp, M[]>> = { EW: { red: [], yellow: [], green: [] }, NS: { red: [], yellow: [], green: [] } };
  for (const [X, , Z] of INTERSECTIONS) for (const a of APPROACH) {
    const cands: [number, number][] = [[X + a.sx * C, Z + a.sz * C], [X + a.sx * (C + 1), Z + a.sz * C], [X + a.sx * C, Z + a.sz * (C + 1)]];
    const p = cands.find(([x, z]) => clearOfRoute(x, z, 0.3));
    if (!p) continue;
    const [px, pz] = p;
    poles.push(mat(px, SIDEWALK_TOP, pz));
    // head hangs over the lane centre (2.6 from centerline), slightly past it
    const hx = a.arm === 'x' ? X + a.sx * 2.2 : px, hz = a.arm === 'z' ? Z + a.sz * 2.2 : pz;
    const L = Math.abs(a.arm === 'x' ? px - hx : pz - hz);
    arms.push(a.arm === 'x' ? mat((px + hx) / 2, ARM_Y, pz, 0, L, 0.12, 0.12) : mat(px, ARM_Y, (pz + hz) / 2, 0, 0.12, 0.12, L));
    const ry = Math.atan2(a.face[0], a.face[1]);
    const hy = ARM_Y - 0.55;
    heads.push(mat(hx, hy, hz, ry, 0.42, 1.08, 0.3));
    LAMPS.forEach((c, i) => {
      lampM[a.axis][c].push(mat(hx + a.face[0] * 0.15, hy + 0.32 - i * 0.32, hz + a.face[1] * 0.15, ry));
    });
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, POLE_H, 10).translate(0, POLE_H / 2, 0);
  const lampGeo = new THREE.SphereGeometry(0.115, 12, 8);
  const lampMats = { EW: {} as Record<Lamp, THREE.MeshStandardMaterial>, NS: {} as Record<Lamp, THREE.MeshStandardMaterial> };
  const meshes: THREE.Object3D[] = [inst(poleGeo, poleMat, poles, true), inst(unitBox, poleMat, arms), inst(unitBox, headMat, heads)];
  for (const ax of ['EW', 'NS'] as const) for (const c of LAMPS) {
    const m = new THREE.MeshStandardMaterial({ color: '#222', emissive: COLORS[c], emissiveIntensity: 0.05, roughness: 0.3 });
    lampMats[ax][c] = m;
    const im = inst(lampGeo, m, lampM[ax][c]); im.receiveShadow = false;
    meshes.push(im);
  }

  // ---- Street lamps every ~18m along each sidewalk run ----
  const SL_H = 6.5;
  const slPoles: M[] = [], slArms: M[] = [], slHeads: M[] = [], slGlow: M[] = [];
  const hyd: M[] = [], cans: M[] = [];
  const r = rng(1337);
  for (const run of RUNS) {
    const len = run.b - run.a;
    const n = Math.max(0, Math.floor((len - 12) / 18) + 1);
    const start = (run.a + run.b) / 2 - ((n - 1) * 18) / 2;
    for (let k = 0; k < n; k++) {
      const p = onRun(run, start + k * 18, CURB_ZONE);
      if (!clearOfRoute(p.x, p.z, 0.3)) continue;
      const base = mat(p.x, SIDEWALK_TOP, p.z, p.ry);
      slPoles.push(base); slArms.push(base); slHeads.push(base); slGlow.push(base);
      // hydrant / trash can between lamps
      const roll = r();
      const along = start + k * 18 + (r() > 0.5 ? 9 : -9);
      if (along < run.a + 3 || along > run.b - 3) continue;
      if (roll < 0.22) {
        const q = onRun(run, along, CURB_ZONE - 0.05);
        if (clearOfRoute(q.x, q.z, 0.3)) hyd.push(mat(q.x, SIDEWALK_TOP, q.z, q.ry));
      } else if (roll < 0.45) {
        const q = onRun(run, along + 1.5, CURB_ZONE + 0.05);
        if (clearOfRoute(q.x, q.z, 0.4)) cans.push(mat(q.x, SIDEWALK_TOP, q.z, q.ry));
      }
    }
  }
  const slPoleGeo = new THREE.CylinderGeometry(0.06, 0.1, SL_H, 8).translate(0, SL_H / 2, 0);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, SL_H - 0.35, 0), new THREE.Vector3(0, SL_H + 0.35, 0.1), new THREE.Vector3(0, SL_H + 0.15, 1.6));
  const slArmGeo = new THREE.TubeGeometry(curve, 12, 0.045, 6, false);
  const slHeadGeo = new THREE.BoxGeometry(0.32, 0.13, 0.62).translate(0, SL_H + 0.12, 1.75);
  const slGlowGeo = new THREE.BoxGeometry(0.24, 0.02, 0.5).translate(0, SL_H + 0.05, 1.75);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 2, roughness: 0.4 });
  const slMat = new THREE.MeshStandardMaterial({ color: '#2a2c2e', metalness: 0.55, roughness: 0.5 });
  meshes.push(inst(slPoleGeo, slMat, slPoles, true), inst(slArmGeo, slMat, slArms), inst(slHeadGeo, slMat, slHeads), inst(slGlowGeo, glowMat, slGlow));

  // ---- Hydrants + trash cans (lathe profiles, one draw call each) ----
  const v = (pts: number[][]) => pts.map(([a, b]) => new THREE.Vector2(a, b));
  const hydGeo = new THREE.LatheGeometry(v([[0, 0], [0.2, 0], [0.2, 0.07], [0.14, 0.1], [0.14, 0.58], [0.18, 0.6], [0.18, 0.65], [0.12, 0.69], [0.08, 0.78], [0.03, 0.82], [0, 0.82]]), 12);
  const canGeo = new THREE.LatheGeometry(v([[0, 0], [0.26, 0], [0.3, 0.05], [0.3, 0.9], [0.32, 0.92], [0.32, 0.97], [0.2, 1.0], [0, 1.02]]), 14);
  const hydMat = new THREE.MeshStandardMaterial({ color: '#c41e1a', roughness: 0.45, metalness: 0.2 });
  const canMat = new THREE.MeshStandardMaterial({ color: '#1f3a2a', roughness: 0.55, metalness: 0.3 });
  meshes.push(inst(hydGeo, hydMat, hyd), inst(canGeo, canMat, cans));

  return { meshes, lampMats };
}

export default function Furniture() {
  const f = useMemo(build, []);
  useFrame(() => {
    for (const ax of ['EW', 'NS'] as const) {
      const lit = signalFor(ax);
      for (const c of LAMPS) f.lampMats[ax][c].emissiveIntensity = c === lit ? 3 : 0.05;
    }
  });
  return <group>{f.meshes.map((m, i) => <primitive key={i} object={m} />)}</group>;
}
