// Shared hero helpers: soft pulsing light pool used as the selection highlight.
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { damp, getGlowTexture } from '../worldState';

export function LightPool({ position, size, on }: { position: [number, number, number]; size: [number, number]; on: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const lvl = useRef(0);
  useFrame(({ clock }, dt) => {
    lvl.current += ((on ? 1 : 0) - lvl.current) * damp(4, dt);
    if (mat.current) mat.current.opacity = lvl.current * (0.45 + 0.2 * Math.sin(clock.elapsedTime * 2.4));
    if (mesh.current) mesh.current.visible = lvl.current > 0.01;
  });
  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={position} renderOrder={2} visible={false}>
      <planeGeometry args={size} />
      <meshBasicMaterial ref={mat} map={getGlowTexture()} color="#ffd9a0" transparent opacity={0}
        depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

/** Box from min/max corners. */
export function B({ x, y, z, c, r = 0.85, m = 0, e, ei = 1, cast = true }: {
  x: [number, number]; y: [number, number]; z: [number, number]; c: string; r?: number; m?: number; e?: string; ei?: number; cast?: boolean;
}) {
  return (
    <mesh position={[(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2]} castShadow={cast} receiveShadow>
      <boxGeometry args={[x[1] - x[0], y[1] - y[0], z[1] - z[0]]} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={e ?? '#000000'} emissiveIntensity={e ? ei : 0} />
    </mesh>
  );
}

// ---- instanced boxes: [x0, x1, y0, y1, z0, z1, rx?] (min/max corners, optional X rotation about the center) ----
export type Bx = [number, number, number, number, number, number, number?];
export function Boxes({ items, cast = true, children }: { items: Bx[]; cast?: boolean; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    items.forEach(([x0, x1, y0, y1, z0, z1, rx = 0], i) => {
      o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      o.rotation.set(rx, 0, 0); o.scale.set(x1 - x0, y1 - y0, z1 - z0); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={cast} receiveShadow>
      <boxGeometry />
      {children}
    </instancedMesh>
  );
}

// ---- windows: frame trim, stone sill/lintel/keystone, recessed glass or warm lit interior ----
export type Win = [number, number, number, number, boolean, number?]; // x, sill y, w, h, lit, facade z override
export type WinSet = { glass: Bx[]; lit: Bx[]; trim: Bx[]; stone: Bx[] };
export function windowSet(wins: Win[], zDefault: number, t = 0.08): WinSet {
  const s: WinSet = { glass: [], lit: [], trim: [], stone: [] };
  for (const [x, y, w, h, l, zo] of wins) {
    const z = zo ?? zDefault, x0 = x - w / 2, x1 = x + w / 2, y1 = y + h, ym = y + h * 0.52;
    (l ? s.lit : s.glass).push([x0, x1, y, y1, z - 0.02, z + 0.02]);
    s.trim.push([x0 - t, x0, y, y1, z, z + 0.12], [x1, x1 + t, y, y1, z, z + 0.12],
      [x0, x1, y1 - t, y1, z, z + 0.12], [x0, x1, y, y + t, z, z + 0.12],
      [x0, x1, ym - 0.035, ym + 0.035, z, z + 0.08], [x - 0.02, x + 0.02, y, y1, z, z + 0.06]);
    s.stone.push([x0 - 0.16, x1 + 0.16, y - 0.12, y, z, z + 0.2], [x0 - 0.2, x1 + 0.2, y1, y1 + 0.3, z, z + 0.1],
      [x - 0.13, x + 0.13, y1 - 0.03, y1 + 0.36, z, z + 0.14]);
  }
  return s;
}
export function Windows({ set, trim, stone }: { set: WinSet; trim: string; stone: string }) {
  return (
    <>
      {set.glass.length > 0 && (
        <Boxes items={set.glass} cast={false}>
          <meshPhysicalMaterial color="#141b21" roughness={0.05} metalness={0.25} clearcoat={1} clearcoatRoughness={0.05} />
        </Boxes>
      )}
      {set.lit.length > 0 && (
        <Boxes items={set.lit} cast={false}>
          <meshStandardMaterial color="#2a1a10" emissive="#ffa94d" emissiveIntensity={0.75} roughness={0.2} />
        </Boxes>
      )}
      <Boxes items={set.trim}><meshStandardMaterial color={trim} roughness={0.55} /></Boxes>
      <Boxes items={set.stone}><meshStandardMaterial color={stone} roughness={0.9} /></Boxes>
    </>
  );
}

// ---- procedural running-bond brick (color + roughness), world-scale UVs ----
const TILE_W = 0.88, TILE_H = 0.98; // 4 bricks (0.22m) x 14 courses (0.07m) per texture tile
const brickCache = new Map<string, { map: THREE.CanvasTexture; rough: THREE.CanvasTexture }>();
function paintBricks(base: string, rough: boolean) {
  const W = 512, H = 512, cols = 4, rows = 14, bw = W / cols, bh = H / rows, mort = 5;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  let seed = 1337; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = new THREE.Color(base), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  g.fillStyle = rough ? '#ffffff' : '#8f877b'; g.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    const rowCol: string[] = [];
    for (let i = 0; i < cols; i++) {
      const v = rnd();
      rowCol.push(rough ? `rgb(${185 + v * 45 | 0},${185 + v * 45 | 0},${185 + v * 45 | 0})`
        : `#${new THREE.Color().setHSL(hsl.h + (rnd() - 0.5) * 0.03, hsl.s * (0.8 + rnd() * 0.35), hsl.l * (0.78 + v * 0.42)).getHexString()}`);
    }
    for (let i = 0; i <= cols; i++) {
      const x = i * bw - off; if (x >= W) continue;
      g.fillStyle = rowCol[i % cols];
      g.fillRect(x + mort / 2, r * bh + mort / 2, bw - mort, bh - mort);
    }
  }
  // speckle + grime streaks
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = rough ? `rgba(255,255,255,${rnd() * 0.25})` : `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},${rnd() * 0.12})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2);
  }
  if (!rough) for (let k = 0; k < 14; k++) {
    g.fillStyle = `rgba(20,14,10,${0.03 + rnd() * 0.05})`;
    const x = rnd() * W; g.fillRect(x, 0, 6 + rnd() * 30, H * (0.3 + rnd() * 0.7));
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (!rough) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function brickTex(base: string) {
  let e = brickCache.get(base);
  if (!e) { e = { map: paintBricks(base, false), rough: paintBricks(base, true) }; brickCache.set(base, e); }
  return e;
}
/** Brick-clad box (min/max corners) with world-scale UVs on every face. */
export function BrickBox({ x, y, z, c }: { x: [number, number]; y: [number, number]; z: [number, number]; c: string }) {
  const w = x[1] - x[0], h = y[1] - y[0], d = z[1] - z[0];
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / TILE_W, (uv.getY(i) * dims[f][1]) / TILE_H);
    }
    return g;
  }, [w, h, d]);
  const tex = brickTex(c);
  return (
    <mesh geometry={geo} position={[(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2]} castShadow receiveShadow>
      <meshStandardMaterial map={tex.map} roughnessMap={tex.rough} roughness={1} bumpMap={tex.rough} bumpScale={-1.2} />
    </mesh>
  );
}
