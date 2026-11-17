// Six-wheeled sidewalk delivery robot. Reads `robotPose` every frame, smooths it into `robotDisplay`, and derives
// wheel spin / steer, body pitch+roll, antenna sway and the cargo-lid animation from the actual motion.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { robotPose, useFoStore } from '../../store';
import { damp, onSelect, robotCargoAnchor, robotDisplay, useHover } from '../worldState';
import { beam, getBlobTexture, merge, place, roundedRect } from './geom';
import StatusLabel from './StatusLabel';
import { groundY } from '../city/roads/layout'; // sidewalks/lots sit 0.15 above the road
let groundS = 0.15;

export const ROBOT_SCALE = 1.6;
const S = ROBOT_SCALE;
const WHEEL_R = 0.1;
const WHEEL_X = 0.325;
const WHEEL_Z = [0.36, 0, -0.36];
const LID_HINGE: [number, number, number] = [0, 0.52, -0.36];
const LID_MAX = 1.22; // ~70°
const CARGO_FLOOR: [number, number, number] = [0, 0.275, -0.03];
const ANTENNA_BASE: [number, number, number] = [-0.2, 0.5, -0.4];
const SEG_LEN = 0.19;
const FLAG_U = 10, FLAG_V = 3, FLAG_L = 0.16, FLAG_H = 0.1;

function shellGeometry() {
  const outer = roundedRect(new THREE.Shape(), 0.5, 0.92, 0.13);
  outer.holes.push(roundedRect(new THREE.Path(), 0.46, 0.66, 0.05, 0, 0.03));
  const g = new THREE.ExtrudeGeometry(outer, {
    depth: 0.17, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: 6, curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.295, 0);
  return g;
}

function lidGeometry() {
  const s = roundedRect(new THREE.Shape(), 0.44, 0.64, 0.05);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.01, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 4, curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  // hinge-local: rear edge at z=0, centered at z=+0.33
  g.translate(0, -0.004, 0.33);
  return g;
}

function tireGeometry() {
  const prof: [number, number][] = [
    [0.064, -0.031], [0.08, -0.036], [0.092, -0.035], [0.099, -0.03], [0.1, -0.022], [0.1, -0.008],
    [0.1, 0.008], [0.1, 0.022], [0.099, 0.03], [0.092, 0.035], [0.08, 0.036], [0.064, 0.031],
  ];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 96);
  // chunky chevron tread lugs on the outer band
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.097) continue;
    const a = Math.atan2(z, x);
    const lug = Math.cos(a * 16 + Math.abs(y) * 40) > 0.1 ? 1 : 0;
    const k = (r + 0.009 * lug) / r;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  g.rotateZ(Math.PI / 2);
  return g;
}

function hubGeometry() {
  const prof: [number, number][] = [
    [0.0, -0.03], [0.062, -0.031], [0.065, -0.026], [0.05, -0.022], [0.03, -0.026], [0.018, -0.034], [0.0, -0.035],
  ];
  const outer = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  const inner = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, -y)), 32);
  inner.scale(-1, 1, 1); // flip winding so the mirrored face points outward
  const g = merge([outer, inner]);
  // five spokes / lug bolts so spin is visible
  const bolts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const sy of [-1, 1]) {
      bolts.push(place(new THREE.BoxGeometry(0.012, 0.006, 0.044), [Math.cos(a) * 0.035, sy * 0.033, Math.sin(a) * 0.035], [0, -a + Math.PI / 2, 0]));
    }
  }
  const out = merge([g, ...bolts]);
  out.rotateZ(Math.PI / 2);
  return out;
}

function buildRobot() {
  const tub = new RoundedBoxGeometry(0.52, 0.16, 0.94, 4, 0.045);
  tub.translate(0, 0.205, 0);

  // dark trim: panel seams, bumpers and the shell/tub shadow line
  const trim: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const z of [0.2, -0.22]) trim.push(place(new THREE.BoxGeometry(0.004, 0.17, 0.004), [sx * 0.2805, 0.385, z]));
    // charging door outline on the right side, service hatch on the left
    trim.push(place(new THREE.BoxGeometry(0.004, 0.003, 0.12), [sx * 0.2805, 0.43, -0.05]));
    trim.push(place(new THREE.BoxGeometry(0.004, 0.003, 0.12), [sx * 0.2805, 0.34, -0.05]));
    trim.push(place(new THREE.BoxGeometry(0.004, 0.09, 0.003), [sx * 0.2805, 0.385, 0.01]));
    trim.push(place(new THREE.BoxGeometry(0.004, 0.09, 0.003), [sx * 0.2805, 0.385, -0.11]));
  }
  for (const sz of [-1, 1]) {
    trim.push(place(new RoundedBoxGeometry(0.5, 0.05, 0.03, 2, 0.012), [0, 0.15, sz * 0.47])); // bumper
    trim.push(place(new THREE.BoxGeometry(0.42, 0.003, 0.004), [0, 0.325, sz * 0.4905]));
  }
  trim.push(place(new THREE.CylinderGeometry(0.02, 0.024, 0.035, 14), [ANTENNA_BASE[0], ANTENNA_BASE[1] + 0.0175, ANTENNA_BASE[2]]));
  // lid hinge barrels
  for (const sx of [-1, 1]) trim.push(place(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 10), [sx * 0.16, 0.508, -0.365], [0, 0, Math.PI / 2]));

  // rocker-bogie suspension links (both sides)
  const links: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * 0.277;
    const M: [number, number, number] = [x, 0.2, 0.08], F: [number, number, number] = [x, WHEEL_R, 0.36];
    const B: [number, number, number] = [x, 0.155, -0.18], Mi: [number, number, number] = [x, WHEEL_R, 0], R: [number, number, number] = [x, WHEEL_R, -0.36];
    links.push(beam(M, F, 0.016, 0.034), beam(M, B, 0.016, 0.034), beam(B, Mi, 0.014, 0.028), beam(B, R, 0.014, 0.028));
    for (const p of [M, B]) links.push(place(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 16), p, [0, 0, Math.PI / 2]));
    for (const z of WHEEL_Z) links.push(place(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), [sx * 0.3, WHEEL_R, z], [0, 0, Math.PI / 2]));
  }

  const glass = new RoundedBoxGeometry(0.34, 0.085, 0.02, 3, 0.008);
  glass.translate(0, 0.43, 0.485);

  const lens: THREE.BufferGeometry[] = [];
  const lensAt = (p: [number, number, number], r: [number, number, number], rad: number) =>
    lens.push(place(new THREE.CylinderGeometry(rad, rad * 1.15, 0.012, 20), p, r));
  lensAt([-0.11, 0.43, 0.497], [Math.PI / 2, 0, 0], 0.015);
  lensAt([0.11, 0.43, 0.497], [Math.PI / 2, 0, 0], 0.015);
  lensAt([0, 0.43, 0.497], [Math.PI / 2, 0, 0], 0.021);
  for (const sx of [-1, 1]) lensAt([sx * 0.283, 0.45, 0.33], [0, 0, Math.PI / 2], 0.012);
  lensAt([0, 0.43, -0.492], [Math.PI / 2, 0, 0], 0.013);
  // radar / ultrasonic dots on the front bumper
  for (const x of [-0.15, -0.05, 0.05, 0.15]) lensAt([x, 0.15, 0.487], [Math.PI / 2, 0, 0], 0.008);

  const led = merge([
    place(new RoundedBoxGeometry(0.36, 0.012, 0.008, 2, 0.004), [0, 0.37, 0.4905]),
    place(new RoundedBoxGeometry(0.36, 0.012, 0.008, 2, 0.004), [0, 0.37, -0.4905]),
  ]);
  const head = merge([-1, 1].map((sx) => place(new RoundedBoxGeometry(0.085, 0.03, 0.012, 2, 0.007), [sx * 0.175, 0.235, 0.47])));
  const tail = merge([-1, 1].map((sx) => place(new RoundedBoxGeometry(0.1, 0.022, 0.012, 2, 0.006), [sx * 0.17, 0.235, -0.47])));

  const liner = new THREE.BoxGeometry(0.4, 0.24, 0.6);
  liner.translate(0, 0.39, -0.03);
  const lidUnder = place(new RoundedBoxGeometry(0.4, 0.01, 0.6, 2, 0.004), [0, -0.012, 0.33]);

  const segs = [0, 1, 2].map((i) => {
    const r0 = 0.0065 - i * 0.0012, r1 = r0 - 0.0012;
    const g = new THREE.CylinderGeometry(r1, r0, SEG_LEN, 8);
    g.translate(0, SEG_LEN / 2, 0);
    return g;
  });
  const tip = new THREE.SphereGeometry(0.008, 10, 8);
  tip.translate(0, SEG_LEN, 0);
  const flag = new THREE.PlaneGeometry(1, 1, FLAG_U, FLAG_V);

  return {
    tub, trim: merge(trim), links: merge(links), shell: shellGeometry(), lid: lidGeometry(), lidUnder, liner,
    glass, lens: merge(lens), led, head, tail, tire: tireGeometry(), hub: hubGeometry(), segs, tip: merge([segs[2].clone(), tip]), flag,
  };
}

function makeMaterials() {
  return {
    shell: new THREE.MeshPhysicalMaterial({ color: '#eceeed', roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.22, sheen: 0 }),
    tub: new THREE.MeshStandardMaterial({ color: '#2b2e31', roughness: 0.78 }),
    trim: new THREE.MeshStandardMaterial({ color: '#17191b', roughness: 0.55, metalness: 0.15 }),
    links: new THREE.MeshStandardMaterial({ color: '#3a3e42', roughness: 0.45, metalness: 0.6 }),
    liner: new THREE.MeshStandardMaterial({ color: '#2a2c2f', roughness: 1, side: THREE.BackSide }),
    lidUnder: new THREE.MeshStandardMaterial({ color: '#34373a', roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#07090c', roughness: 0.06, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#020304', roughness: 0.12, metalness: 0.8, clearcoat: 1, emissive: '#0a1a2a', emissiveIntensity: 0.6 }),
    led: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#dff1ff', emissiveIntensity: 2.2, toneMapped: false }),
    head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dd', emissiveIntensity: 3, toneMapped: false }),
    tail: new THREE.MeshStandardMaterial({ color: '#400000', emissive: '#ff2a1a', emissiveIntensity: 1.6, toneMapped: false }),
    tire: new THREE.MeshStandardMaterial({ color: '#1b1b1c', roughness: 0.93 }),
    hub: new THREE.MeshStandardMaterial({ color: '#a7adb2', roughness: 0.42, metalness: 0.35 }),
    antenna: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4 }),
    flag: new THREE.MeshStandardMaterial({ color: '#ff5f14', roughness: 0.85, side: THREE.DoubleSide }),
    blob: new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false, opacity: 0.55, color: '#000000' }),
  };
}

const shortestAngle = (from: number, to: number) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
type Spring = { x: number; v: number };
const spring = (s: Spring, target: number, k: number, c: number, dt: number) => {
  s.v += (k * (target - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
};
const LOAD_RE = /load|drop|unload|pick|handoff|hand off/i;

const _t = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

export default function Robot() {
  const g = useMemo(buildRobot, []);
  const m = useMemo(makeMaterials, []);
  const { bind } = useHover();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const tires = useRef<THREE.InstancedMesh>(null);
  const hubs = useRef<THREE.InstancedMesh>(null);
  const seg0 = useRef<THREE.Group>(null);
  const seg1 = useRef<THREE.Group>(null);
  const seg2 = useRef<THREE.Group>(null);
  const flagMesh = useRef<THREE.Mesh>(null);
  const k = useRef({
    last: new THREE.Vector3(), lastH: 0, init: false, v: 0, acc: 0, yaw: 0, spinL: 0, spinR: 0, steer: 0,
    pitch: { x: 0, v: 0 } as Spring, roll: { x: 0, v: 0 } as Spring,
    bx: { x: 0, v: 0 } as Spring, bz: { x: 0, v: 0 } as Spring,
    open: 0, loc: '', locT: -99, move: 0,
  }).current;

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(Math.max(rawDt, 1e-4), 1 / 20);
    const t = clock.elapsedTime;
    const st = useFoStore.getState();

    // ---- pose smoothing → robotDisplay
    const [px, py, pz] = robotPose.position;
    if (!robotDisplay.ready) {
      robotDisplay.position.set(px, py, pz);
      robotDisplay.heading = robotPose.heading;
      robotDisplay.ready = true;
    } else {
      _t.set(px, py, pz);
      if (_t.distanceToSquared(robotDisplay.position) > 25) robotDisplay.position.copy(_t);
      else robotDisplay.position.lerp(_t, damp(22, dt));
      robotDisplay.heading += shortestAngle(robotDisplay.heading, robotPose.heading) * damp(16, dt);
    }
    const p = robotDisplay.position, h = robotDisplay.heading;

    // ---- kinematics from the displayed motion
    if (!k.init) { k.last.copy(p); k.lastH = h; k.init = true; }
    const dx = p.x - k.last.x, dz = p.z - k.last.z;
    let ds = dx * Math.sin(h) + dz * Math.cos(h);
    let dh = shortestAngle(k.lastH, h);
    if (Math.hypot(dx, dz) > 3) { ds = 0; dh = 0; }
    k.last.copy(p); k.lastH = h;
    const vNow = ds / dt;
    k.acc += ((vNow - k.v) / dt - k.acc) * damp(6, dt);
    k.v += (vNow - k.v) * damp(25, dt);
    k.yaw += (dh / dt - k.yaw) * damp(12, dt);
    const lat = k.v * k.yaw;
    const moving = st.robot.moving || Math.abs(k.v) > 0.15;
    k.move += ((moving ? 1 : 0) - k.move) * damp(4, dt);

    // wheels: differential spin + steer into turns
    const half = WHEEL_X * S;
    k.spinL += (ds - dh * half) / (WHEEL_R * S);
    k.spinR += (ds + dh * half) / (WHEEL_R * S);
    k.steer += (clamp(k.yaw * 0.22, -0.38, 0.38) - k.steer) * damp(10, dt);
    if (tires.current && hubs.current) {
      let i = 0;
      for (const sx of [1, -1]) {
        for (let j = 0; j < 3; j++) {
          const steer = j === 0 ? k.steer : j === 2 ? -k.steer : 0;
          _e.set(sx > 0 ? k.spinL : k.spinR, steer, 0, 'YXZ');
          _q.setFromEuler(_e);
          _p.set(sx * WHEEL_X, WHEEL_R, WHEEL_Z[j]);
          _m.compose(_p, _q, _one);
          tires.current.setMatrixAt(i, _m);
          hubs.current.setMatrixAt(i, _m);
          i++;
        }
      }
      tires.current.instanceMatrix.needsUpdate = true;
      hubs.current.instanceMatrix.needsUpdate = true;
    }

    // body pitch (squat on accel, dive on braking) and roll (outward in turns)
    spring(k.pitch, -clamp(k.acc * 0.011, -0.06, 0.06), 90, 9, dt);
    spring(k.roll, clamp(lat * 0.009, -0.055, 0.055), 90, 9, dt);
    if (root.current) {
      // ride up/down the curb ramps smoothly (sidewalk 0.15, road/crosswalk 0)
      groundS += (groundY(p.x, p.z) - groundS) * Math.min(1, dt * 8);
      root.current.position.set(p.x, p.y + groundS, p.z);
      root.current.rotation.y = h;
    }
    if (body.current) {
      body.current.rotation.x = k.pitch.x + Math.sin(t * 31) * 0.0025 * k.move;
      body.current.rotation.z = k.roll.x + Math.sin(t * 23 + 1) * 0.002 * k.move;
      body.current.position.y = Math.sin(t * 41) * 0.0018 * k.move;
    }

    // antenna whip: underdamped spring driven by acceleration
    spring(k.bx, -clamp(k.acc * 0.045, -0.45, 0.45) - 0.05 * k.move, 55, 2.6, dt);
    spring(k.bz, clamp(lat * 0.03, -0.4, 0.4), 55, 2.6, dt);
    const idle = Math.sin(t * 1.4) * 0.012 + Math.sin(t * 17) * 0.01 * k.move;
    const segs = [seg0.current, seg1.current, seg2.current];
    const w = [0.22, 0.34, 0.44];
    for (let i = 0; i < 3; i++) {
      const s = segs[i];
      if (!s) continue;
      s.rotation.x = (k.bx.x + idle) * w[i];
      s.rotation.z = k.bz.x * w[i];
    }

    // flag cloth: wave grows with speed, droops when parked
    const fm = flagMesh.current;
    if (fm) {
      const pos = fm.geometry.attributes.position as THREE.BufferAttribute;
      const sp = clamp(Math.abs(k.v) / 3, 0, 1);
      const freq = 4 + 9 * sp;
      for (let iy = 0; iy <= FLAG_V; iy++) {
        for (let ix = 0; ix <= FLAG_U; ix++) {
          const u = ix / FLAG_U, v = iy / FLAG_V;
          const idx = iy * (FLAG_U + 1) + ix;
          const amp = (0.006 + 0.016 * sp) * u;
          const x = Math.sin(u * 7 - t * freq + v * 0.8) * amp;
          const y = (0.5 - v) * FLAG_H * (1 - 0.25 * u) - u * u * 0.05 * (1 - sp);
          pos.setXYZ(idx, x, y, -u * FLAG_L * (1 - 0.08 * (1 - sp)));
        }
      }
      pos.needsUpdate = true;
      fm.geometry.computeVertexNormals();
    }

    // cargo lid: open while loading / dropping and briefly around item hand-offs
    const loc = st.item.location;
    if (k.loc !== loc) { if (k.loc) k.locT = t; k.loc = loc; }
    const wantOpen = (LOAD_RE.test(st.robot.status) && !st.robot.moving) || t - k.locT < 1.25;
    k.open = clamp(k.open + (wantOpen ? 1 : -1) * dt / 0.6, 0, 1);
    if (lid.current) lid.current.rotation.x = -smooth(k.open) * LID_MAX;

    // LED strip: cool white while driving, slow amber breathing while waiting, soft green while the lid is open
    const breath = 0.5 + 0.5 * Math.sin(t * 2.2);
    if (k.open > 0.05) { m.led.emissive.set('#9dffcf'); m.led.emissiveIntensity = 1.4 + breath * 0.6; }
    else if (k.move > 0.5) { m.led.emissive.set('#e4f3ff'); m.led.emissiveIntensity = 2.4; }
    else { m.led.emissive.set('#ffb35c'); m.led.emissiveIntensity = 0.7 + breath * 0.9; }
    m.tail.emissiveIntensity = k.acc < -0.8 ? 3.2 : 1.4;
  });

  return (
    <group ref={root} onClick={onSelect('robot')} {...bind}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} material={m.blob} scale={[1.25 * S * 0.8, 1.6 * S * 0.8, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group scale={S}>
        <instancedMesh ref={tires} args={[g.tire, m.tire, 6]} castShadow receiveShadow frustumCulled={false} />
        <instancedMesh ref={hubs} args={[g.hub, m.hub, 6]} castShadow frustumCulled={false} />
        <mesh geometry={g.links} material={m.links} castShadow />
        <group ref={body} position-y={0}>
          <mesh geometry={g.tub} material={m.tub} castShadow receiveShadow />
          <mesh geometry={g.shell} material={m.shell} castShadow receiveShadow />
          <mesh geometry={g.trim} material={m.trim} />
          <mesh geometry={g.liner} material={m.liner} receiveShadow />
          <mesh geometry={g.glass} material={m.glass} />
          <mesh geometry={g.lens} material={m.lens} />
          <mesh geometry={g.led} material={m.led} />
          <mesh geometry={g.head} material={m.head} />
          <mesh geometry={g.tail} material={m.tail} />
          <group ref={(o) => { robotCargoAnchor.current = o; }} position={CARGO_FLOOR} />
          <group ref={lid} position={LID_HINGE}>
            <mesh geometry={g.lid} material={m.shell} castShadow receiveShadow />
            <mesh geometry={g.lidUnder} material={m.lidUnder} />
          </group>
          <group position={[ANTENNA_BASE[0], ANTENNA_BASE[1] + 0.035, ANTENNA_BASE[2]]}>
            <group ref={seg0}>
              <mesh geometry={g.segs[0]} material={m.antenna} castShadow />
              <group ref={seg1} position-y={SEG_LEN}>
                <mesh geometry={g.segs[1]} material={m.antenna} castShadow />
                <group ref={seg2} position-y={SEG_LEN}>
                  <mesh geometry={g.tip} material={m.antenna} />
                  <mesh ref={flagMesh} geometry={g.flag} material={m.flag} position={[0, SEG_LEN - FLAG_H * 0.55, 0]} castShadow />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      <StatusLabel />
    </group>
  );
}
