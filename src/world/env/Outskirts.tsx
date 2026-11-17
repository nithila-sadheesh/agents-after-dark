// Everything beyond CITY_BOUNDS: a huge street-grid ground plane slightly below y=0 and a far-field skyline of
// simple blocks that dissolves into the haze. 2 draw calls, nothing here casts shadows. OWNER: env agent.
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CITY_BOUNDS } from '../../../shared/world';

const BLOCK = 40;          // street pitch, continues the city grid (streets at x ≡ 20, z ≡ 0 mod 40)
const GROUND = 4000;       // plane size (multiple of 2*BLOCK so the tiling lines up with world coordinates)
const FAR_R = 560;         // far skyline radius

function groundTexture() {
  // One 40x40m cell: asphalt street bands at u=0.5 (x≡20) and v=0 (z≡0), curbs, sidewalks, mottled lots.
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const px = N / BLOCK;
  g.fillStyle = '#6f6a62';
  g.fillRect(0, 0, N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const v = 80 + rnd() * 50;
    g.fillStyle = `rgba(${v + 8},${v + 4},${v - 4},0.25)`;
    g.fillRect(rnd() * N, rnd() * N, 2 + rnd() * 26, 2 + rnd() * 26);
  }
  const band = (vertical: boolean, center: number, width: number, color: string) => {
    g.fillStyle = color;
    const a = (center - width / 2) * px, w = width * px;
    for (const off of [-N, 0, N]) {
      if (vertical) g.fillRect(a + off, 0, w, N); else g.fillRect(0, a + off, N, w);
    }
  };
  for (const vertical of [true, false]) {
    const c0 = vertical ? BLOCK / 2 : 0;
    band(vertical, c0, 16, '#9a958c');   // sidewalks
    band(vertical, c0, 10.4, '#7d7a75'); // curb
    band(vertical, c0, 10, '#45464a');   // asphalt
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(GROUND / BLOCK, GROUND / BLOCK);
  t.anisotropy = 8;
  return t;
}

function hash(n: number) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

const PALETTE = ['#b9a58e', '#c9b9a2', '#9b8676', '#a35f4b', '#8c4e3f', '#d8cdbd', '#8d969e', '#6f7c88', '#c2c8cc', '#e3d6c0', '#7a8b98', '#b07a5b'];

function farBlocks() {
  const out: { x: number; z: number; w: number; d: number; h: number; c: string }[] = [];
  let k = 0;
  for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
    // block interior between streets: x ∈ [28+40i, 52+40i], z ∈ [8+40j, 32+40j]
    const x0 = 28 + BLOCK * i, z0 = 8 + BLOCK * j;
    const cx = x0 + 12, cz = z0 + 12;
    const r = Math.hypot(cx, cz);
    if (r > FAR_R) continue;
    if (x0 + 24 > CITY_BOUNDS.minX - 2 && x0 < CITY_BOUNDS.maxX + 2 && z0 + 24 > CITY_BOUNDS.minZ - 2 && z0 < CITY_BOUNDS.maxZ + 2) continue;
    const split = hash(i * 31 + j * 7) < 0.5 ? 2 : 3;
    const cell = 24 / split;
    for (let a = 0; a < split; a++) for (let b = 0; b < split; b++) {
      const n = ++k * 1.37 + i * 17.1 + j * 3.3;
      if (hash(n + 9) < 0.08) continue; // occasional gap / plaza
      // downtown cluster behind the city (toward -Z), mid-rise elsewhere
      const downtown = Math.exp(-(((cx + 30) / 220) ** 2 + ((cz + 260) / 140) ** 2));
      const tall = hash(n + 2) ** 3;
      const h = 9 + hash(n + 1) * 18 + tall * (35 + downtown * 120) + downtown * 30;
      const shrink = 0.6 + hash(n + 3) * 1.2;
      out.push({
        x: x0 + cell * (a + 0.5), z: z0 + cell * (b + 0.5),
        w: cell - shrink, d: cell - (0.6 + hash(n + 4) * 1.2), h,
        c: PALETTE[Math.floor(hash(n + 5) * PALETTE.length)],
      });
    }
  }
  return out;
}

export default function Outskirts() {
  const tex = useMemo(groundTexture, []);
  const blocks = useMemo(farBlocks, []);
  const inst = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);

  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    const o = new THREE.Object3D(), col = new THREE.Color();
    blocks.forEach((b, i) => {
      o.position.set(b.x, -0.1, b.z);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, col.set(b.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [blocks]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.12} receiveShadow raycast={() => null}>
        <planeGeometry args={[GROUND, GROUND]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      <instancedMesh ref={inst} args={[geo, undefined, blocks.length]} raycast={() => null}>
        <meshStandardMaterial roughness={0.85} metalness={0.05} envMapIntensity={0.6} />
      </instancedMesh>
    </group>
  );
}
