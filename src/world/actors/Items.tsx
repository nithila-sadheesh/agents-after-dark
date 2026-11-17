// The carried item: a cloth laundry sack (dirty), a dry-cleaned garment bundle in clear wrap (clean), or a
// cardboard parcel. Rests at ITEM_SPOTS, rides in the robot's cargo well, and arcs in/out of the open lid.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEM_SPOTS } from '../../../shared/world';
import { useFoStore, type ItemLocation } from '../../store';
import { itemDisplay, onSelect, robotCargoAnchor, useHover } from '../worldState';
import { getBlobTexture, merge, place, tint } from './geom';
import { ROBOT_SCALE } from './Robot';
import { groundY } from '../city/roads/layout'; // sidewalks/lots sit 0.15 above the road

// ---------------------------------------------------------------- laundry sack
function sackGeometry() {
  const prof: [number, number][] = [
    [0, 0], [0.1, 0.003], [0.17, 0.016], [0.205, 0.05], [0.218, 0.12], [0.215, 0.21], [0.2, 0.3], [0.17, 0.375],
    [0.125, 0.43], [0.075, 0.468], [0.05, 0.488], [0.048, 0.5], [0.06, 0.515], [0.085, 0.54], [0.1, 0.565],
    [0.095, 0.578], [0.07, 0.572], [0.03, 0.566], [0, 0.564],
  ];
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) { p.setXYZ(i, x, y, z); continue; }
    const a = Math.atan2(z, x);
    const body = 1 - smoothstep(0.38, 0.47, y);
    const neck = smoothstep(0.36, 0.47, y) * (1 - smoothstep(0.52, 0.57, y));
    const ruff = smoothstep(0.5, 0.56, y);
    let k = 1
      + body * (0.045 * Math.sin(a * 5 + y * 9) + 0.025 * Math.sin(a * 11 - y * 17 + 1.3) + 0.012 * Math.sin(a * 23 + y * 31))
      + neck * 0.16 * Math.pow(Math.abs(Math.sin(a * 9 + y * 4)), 0.6)
      + ruff * 0.22 * Math.sin(a * 13 + 0.7);
    // slump: wider at the base, the top leans and droops a little
    k *= 1 + 0.06 * (1 - smoothstep(0, 0.12, y));
    x *= k; z *= k * 0.86;
    x += y * y * 0.18;
    y *= 1 - 0.04 * Math.cos(a - 0.4) * smoothstep(0.2, 0.5, y);
    if (y < 0.004) y = 0;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function drawstringGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const ring = new THREE.TorusGeometry(0.056, 0.0075, 8, 40);
  ring.rotateX(Math.PI / 2);
  parts.push(place(ring, [0.0 + 0.49 * 0.49 * 0.18, 0.497, 0]));
  const x0 = 0.043 + 0.04;
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0, 0.497, s * 0.012),
      new THREE.Vector3(x0 + 0.03, 0.47, s * 0.03),
      new THREE.Vector3(x0 + 0.06, 0.4, s * 0.045 + 0.01),
      new THREE.Vector3(x0 + 0.075 + s * 0.01, 0.33 + s * 0.03, s * 0.05 + 0.03),
    ]);
    parts.push(new THREE.TubeGeometry(curve, 20, 0.006, 6, false));
    const end = curve.getPoint(1);
    parts.push(place(new THREE.CylinderGeometry(0.009, 0.009, 0.022, 8), [end.x, end.y - 0.008, end.z]));
  }
  const stopper = new THREE.CylinderGeometry(0.014, 0.012, 0.03, 10);
  parts.push(place(stopper, [x0 + 0.018, 0.48, 0], [0, 0, 0.5]));
  return merge(parts);
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------- dry-cleaned bundle
function bundleGeometry() {
  const colors = ['#f3f1ec', '#9db7d6', '#2b3550', '#e9e4d8'];
  const parts: THREE.BufferGeometry[] = [];
  let y = 0.012;
  const hs = [0.05, 0.045, 0.055, 0.04];
  hs.forEach((h, i) => {
    const b = new RoundedBoxGeometry(0.36 - i * 0.01, h, 0.27 - i * 0.008, 3, Math.min(0.02, h * 0.45));
    parts.push(tint(place(b, [0.004 * (i % 2 ? 1 : -1), y + h / 2, 0.003 * i], [0, (i - 1.5) * 0.025, 0]), colors[i]));
    // shirt collar / placket on the top garment
    y += h;
  });
  const collar = new THREE.TorusGeometry(0.045, 0.012, 6, 20, Math.PI * 1.2);
  collar.rotateX(-Math.PI / 2);
  parts.push(tint(place(collar, [0, y + 0.004, 0.06], [0, 0, 0]), '#f7f6f2'));
  parts.push(tint(place(new THREE.BoxGeometry(0.03, 0.006, 0.17), [0, y + 0.002, -0.02]), '#ebe8e0'));
  for (const z of [0.0, -0.05, -0.1]) parts.push(tint(place(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10), [0, y + 0.006, z]), '#d8d4ca'));
  return { garments: merge(parts, true), top: y };
}

function hangerGeometry(top: number) {
  const parts: THREE.BufferGeometry[] = [];
  const hook = new THREE.TorusGeometry(0.035, 0.0035, 6, 24, Math.PI * 1.35);
  parts.push(place(hook, [0, top + 0.075, 0.13], [0, Math.PI / 2, -0.3]));
  parts.push(place(new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 6), [0, top + 0.035, 0.135]));
  parts.push(place(new THREE.CylinderGeometry(0.008, 0.01, 0.012, 8), [0, top + 0.008, 0.135]));
  return merge(parts);
}

// ---------------------------------------------------------------- parcel
function cardboardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#b88b5a';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const v = Math.random();
    x.fillStyle = v > 0.5 ? `rgba(255,236,200,${0.05 * Math.random()})` : `rgba(70,40,10,${0.07 * Math.random()})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 256; i += 4) { x.fillStyle = 'rgba(80,50,20,0.035)'; x.fillRect(i, 0, 2, 256); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function labelTexture(processed: boolean) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fbfaf6';
  x.fillRect(0, 0, 256, 192);
  x.fillStyle = '#111';
  x.font = 'bold 18px Inter, sans-serif';
  x.fillText('SHIP TO', 14, 26);
  x.fillRect(14, 34, 228, 2);
  x.font = '13px Inter, sans-serif';
  ['M. RIVERA', '214 ELM STREET, APT 3', 'BROOKSIDE  NY 11201'].forEach((s, i) => x.fillText(s, 14, 56 + i * 17));
  for (let i = 0, px = 14; px < 200; i++) {
    const w = 1 + ((i * 7919) % 4);
    if (i % 2 === 0) x.fillRect(px, 118, w, 52);
    px += w + 1;
  }
  x.font = 'bold 22px Inter, sans-serif';
  x.fillText('1Z', 206, 150);
  if (processed) {
    x.strokeStyle = '#1d6b3a'; x.lineWidth = 4;
    x.beginPath(); x.arc(206, 60, 26, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(193, 60); x.lineTo(203, 71); x.lineTo(220, 50); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const BOX = [0.44, 0.3, 0.34] as const;
function tapeGeometry() {
  const [w, h, d] = BOX;
  return merge([
    place(new THREE.BoxGeometry(0.075, 0.0016, d + 0.002), [0, h + 0.0008, 0]),
    place(new THREE.BoxGeometry(0.075, 0.11, 0.0016), [0, h - 0.055, d / 2 + 0.0008]),
    place(new THREE.BoxGeometry(0.075, 0.11, 0.0016), [0, h - 0.055, -d / 2 - 0.0008]),
    place(new THREE.BoxGeometry(w + 0.002, 0.06, 0.0016), [0, 0.03, d / 2 + 0.0008]),
  ]);
}

// ---------------------------------------------------------------- shared assets
function makeAssets() {
  const sack = sackGeometry();
  const bundle = bundleGeometry();
  const wrap = new RoundedBoxGeometry(0.4, bundle.top + 0.03, 0.31, 4, 0.04);
  wrap.translate(0, (bundle.top + 0.03) / 2, 0);
  const tag = new THREE.BoxGeometry(0.07, 0.002, 0.1);
  tag.rotateY(0.25);
  tag.translate(0.09, bundle.top + 0.031, -0.05);
  const box = new RoundedBoxGeometry(BOX[0], BOX[1], BOX[2], 2, 0.008);
  box.translate(0, BOX[1] / 2, 0);
  const label = new THREE.PlaneGeometry(0.15, 0.112);
  label.rotateX(-Math.PI / 2);
  label.translate(-0.11, BOX[1] + 0.0022, 0.06);
  return {
    sack, cord: drawstringGeometry(),
    garments: bundle.garments, wrap, tag, hanger: hangerGeometry(bundle.top),
    box, tape: tapeGeometry(), label,
    m: {
      sack: new THREE.MeshPhysicalMaterial({ color: '#b9ae98', roughness: 0.93, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color('#efe6d2') }),
      cord: new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.8 }),
      garments: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.8, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') }),
      wrap: new THREE.MeshPhysicalMaterial({
        color: '#ffffff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1,
        clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide,
      }),
      tag: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.75 }),
      hanger: new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.25, metalness: 0.9 }),
      box: new THREE.MeshStandardMaterial({ map: cardboardTexture(), roughness: 0.92 }),
      tape: new THREE.MeshStandardMaterial({ color: '#c9a66b', roughness: 0.3, transparent: true, opacity: 0.85 }),
      label: new THREE.MeshStandardMaterial({ map: labelTexture(false), roughness: 0.6 }),
      labelDone: new THREE.MeshStandardMaterial({ map: labelTexture(true), roughness: 0.6 }),
      blob: new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: '#000000' }),
    },
  };
}
type Assets = ReturnType<typeof makeAssets>;

function ItemModel({ a, kind, clean }: { a: Assets; kind: 'laundry_bag' | 'package'; clean: boolean }) {
  if (kind === 'package') {
    return (
      <group>
        <mesh geometry={a.box} material={a.m.box} castShadow receiveShadow />
        <mesh geometry={a.tape} material={a.m.tape} />
        <mesh geometry={a.label} material={clean ? a.m.labelDone : a.m.label} />
      </group>
    );
  }
  if (clean) {
    return (
      <group>
        <mesh geometry={a.garments} material={a.m.garments} castShadow receiveShadow />
        <mesh geometry={a.hanger} material={a.m.hanger} castShadow />
        <mesh geometry={a.tag} material={a.m.tag} />
        <mesh geometry={a.wrap} material={a.m.wrap} renderOrder={2} />
      </group>
    );
  }
  return (
    <group>
      <mesh geometry={a.sack} material={a.m.sack} castShadow receiveShadow />
      <mesh geometry={a.cord} material={a.m.cord} castShadow />
    </group>
  );
}

// ---------------------------------------------------------------- actor + transitions
const ITEM_SCALE = 1.15;
const ARC_TIME = 0.85;
const REST_YAW: Record<'home' | 'shop', number> = { home: 0.5, shop: -0.3 };
/** Fit inside the cargo well (sack squashes, others ride as-is). */
const STOW = { laundry_bag: new THREE.Vector3(0.95, 0.6, 0.95), clean: new THREE.Vector3(1, 1, 1), package: new THREE.Vector3(1, 1, 1) };
const ONE = new THREE.Vector3(1, 1, 1);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
const _e = new THREE.Euler(), _s = new THREE.Vector3();

export default function Item() {
  const a = useMemo(makeAssets, []);
  const kind = useFoStore((s) => s.scene.itemKind);
  const clean = useFoStore((s) => s.item.clean);
  const { bind } = useHover();
  const g = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Mesh>(null);
  const st = useRef({
    loc: null as ItemLocation | null, t: 1, settle: 1,
    from: new THREE.Vector3(), fromQ: new THREE.Quaternion(), fromS: new THREE.Vector3(1, 1, 1),
    target: new THREE.Vector3(), targetQ: new THREE.Quaternion(), targetS: new THREE.Vector3(1, 1, 1),
  }).current;

  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const s = useFoStore.getState();
    const loc = s.item.location;
    const stow = s.scene.itemKind === 'package' ? STOW.package : s.item.clean ? STOW.clean : STOW.laundry_bag;

    // current resting target
    const anchor = robotCargoAnchor.current;
    if (loc === 'robot' && anchor) {
      anchor.updateWorldMatrix(true, false);
      anchor.matrixWorld.decompose(st.target, st.targetQ, _s);
      st.targetS.copy(stow);
    } else {
      const spot = ITEM_SPOTS[loc === 'shop' ? 'shop' : 'home'];
      st.target.set(spot[0], spot[1] + groundY(spot[0], spot[2]), spot[2]);
      st.targetQ.setFromEuler(_e.set(0, REST_YAW[loc === 'shop' ? 'shop' : 'home'], 0));
      st.targetS.copy(ONE);
    }

    if (st.loc === null) {
      st.loc = loc;
      grp.position.copy(st.target); grp.quaternion.copy(st.targetQ); grp.scale.copy(st.targetS).multiplyScalar(ITEM_SCALE);
    } else if (loc !== st.loc) {
      st.loc = loc; st.t = 0;
      st.from.copy(grp.position); st.fromQ.copy(grp.quaternion); st.fromS.copy(grp.scale).divideScalar(ITEM_SCALE);
    }

    if (st.t < 1) {
      st.t = Math.min(1, st.t + dt / ARC_TIME);
      const e = ease(st.t);
      // cubic bezier: lift straight up, travel, then drop straight down into place (through the open lid)
      const lift = 0.7 + 0.08 * st.from.distanceTo(st.target);
      _a.copy(st.from); _b.copy(st.target);
      _c1.copy(_a); _c1.y += lift;
      _c2.copy(_b); _c2.y += lift + 0.15 * ROBOT_SCALE;
      const u = e, v = 1 - e;
      grp.position.set(0, 0, 0)
        .addScaledVector(_a, v * v * v).addScaledVector(_c1, 3 * v * v * u)
        .addScaledVector(_c2, 3 * v * u * u).addScaledVector(_b, u * u * u);
      grp.quaternion.slerpQuaternions(st.fromQ, st.targetQ, e);
      const swing = Math.sin(Math.PI * st.t);
      if (s.scene.itemKind !== 'package') grp.rotateZ(swing * 0.12 * Math.sin(st.t * 9));
      _s.lerpVectors(st.fromS, st.targetS, e);
      // soft goods stretch a little while lifted
      if (s.scene.itemKind === 'laundry_bag' && !s.item.clean) _s.y *= 1 + swing * 0.08;
      grp.scale.copy(_s).multiplyScalar(ITEM_SCALE);
      if (st.t >= 1) st.settle = 0;
    } else {
      grp.position.copy(st.target);
      grp.quaternion.copy(st.targetQ);
      _s.copy(st.targetS);
      if (st.settle < 1) {
        st.settle = Math.min(1, st.settle + dt / 0.35);
        const q = Math.sin(Math.PI * st.settle) * (1 - st.settle);
        const soft = s.scene.itemKind === 'laundry_bag' && !s.item.clean ? 1 : 0.25;
        _s.x *= 1 + q * 0.12 * soft; _s.z *= 1 + q * 0.12 * soft; _s.y *= 1 - q * 0.18 * soft;
      }
      grp.scale.copy(_s).multiplyScalar(ITEM_SCALE);
    }
    itemDisplay.position.copy(grp.position);

    // contact shadow only when resting on the ground
    if (blob.current) {
      const onGround = loc !== 'robot' && st.t >= 1;
      const bm = blob.current.material as THREE.MeshBasicMaterial;
      bm.opacity += ((onGround ? 0.5 : 0) - bm.opacity) * Math.min(1, dt * 10);
      blob.current.visible = bm.opacity > 0.01;
      blob.current.position.set(grp.position.x, groundY(grp.position.x, grp.position.z) + 0.011, grp.position.z);
    }
  });

  return (
    <>
      <mesh ref={blob} rotation-x={-Math.PI / 2} material={a.m.blob} scale={0.75} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={g} onClick={onSelect('item')} {...bind}>
        <ItemModel a={a} kind={kind} clean={clean} />
      </group>
    </>
  );
}

