// OWNER: buildings agent. Procedural, seeded city blocks: one merged mesh with a window-grid facade shader.
import { useMemo } from 'react';
import * as THREE from 'three';
import { CITY_BOUNDS, HOME_LOT, LOT_SETBACK, SHOP_LOT, STREETS_X, STREETS_Z } from '../../../shared/world';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BRICK = ['#8a3b2c', '#7a3a2e', '#9a4a34', '#6e4a3a', '#a0522d', '#5e352a', '#b5653f', '#83402f'];
const STUCCO = ['#c96f4a', '#d98c5f', '#efe3c8', '#f0dcb0', '#a9c8b2', '#9fb89a', '#93b5c9', '#8aa6bf', '#e3b25b', '#d9a441', '#e6a59a'];
const LIME = ['#d6ccb4', '#cfc6ae', '#e0d7c2'];
const TRIM = ['#ddd4bf', '#f3efe6', '#bfb6a0'];
const AWN = ['#b8322a', '#1f5a3a', '#1e3f6e', '#e0a32e', '#26282b', '#7a2d4a', '#2f6f73', '#c2562f'];
const NEAR = { minX: -60, maxX: 20, minZ: -30, maxZ: 45 };

type Buf = { P: number[]; N: number[]; U: number[]; G: number[]; C: number[]; M: number[]; I: number[] };
const mkBuf = (): Buf => ({ P: [], N: [], U: [], G: [], C: [], M: [], I: [] });
function toGeo(b: Buf) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
  geo.setAttribute('aFUv', new THREE.Float32BufferAttribute(b.U, 2));
  geo.setAttribute('aGrid', new THREE.Float32BufferAttribute(b.G, 4));
  geo.setAttribute('aWall', new THREE.Float32BufferAttribute(b.C, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(b.M, 2));
  geo.setIndex(b.I);
  return geo;
}

function build() {
  const r = rng(20251116);
  const near = mkBuf(), far = mkBuf(), glass = mkBuf();
  const tanks: number[][] = [], acs: number[][] = [], awnings: number[][] = [];
  const quad = (B: Buf, c: number[][], n: number[], uv: number[][], g: number[], col: THREE.Color, m: number[]) => {
    const b = B.P.length / 3;
    for (let k = 0; k < 4; k++) { B.P.push(...c[k]); B.N.push(...n); B.U.push(...uv[k]); B.G.push(...g); B.C.push(col.r, col.g, col.b); B.M.push(...m); }
    B.I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  const prism = (B: Buf, x0: number, x1: number, z0: number, z1: number, y0: number, h: number, g: number[], col: THREE.Color, m: number[], top: number[]) => {
    const faces: [number[], number[], number[], number][] = [
      [[x0, z1], [x1, z1], [0, 0, 1], x1 - x0],
      [[x1, z0], [x0, z0], [0, 0, -1], x1 - x0],
      [[x1, z1], [x1, z0], [1, 0, 0], z1 - z0],
      [[x0, z0], [x0, z1], [-1, 0, 0], z1 - z0],
    ];
    for (const [a, b, n, w] of faces)
      quad(B, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], n, [[0, y0], [w, y0], [w, h], [0, h]], g, col, m);
    quad(B, [[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], top, col, m);
  };
  // face: +1/-1 = storefront faces +z/-z street; floors used for rooftop clutter
  const box = (x0: number, x1: number, z0: number, z1: number, h: number, shopGround: boolean, floors = 0, face = 0, skyline = false) => {
    const seed = r() * 100;
    const isNear = x0 < NEAR.maxX && x1 > NEAR.minX && z0 < NEAR.maxZ && z1 > NEAR.minZ;
    if (h > 60) {
      prism(glass, x0, x1, z0, z1, -0.2, h, [0, 0, 0, h], new THREE.Color('#1c3a40'), [3, seed], [0, 0, 0, -1]);
      return;
    }
    const t = r(), ty = t < 0.5 ? 0 : t < 0.86 ? 1 : 2;
    const pal = ty === 0 ? BRICK : ty === 1 ? STUCCO : LIME;
    const col = new THREE.Color(pal[Math.floor(r() * pal.length)]);
    const g = [1.8 + r() * 0.8, 3.1 + r() * 0.4, shopGround ? 4.2 : 0, h];
    const B = isNear ? near : far;
    prism(B, x0, x1, z0, z1, -0.2, h, g, col, [ty, seed], [0, 0, 0, -1]);
    // cornice / parapet slab
    const trim = new THREE.Color(TRIM[ty]);
    const o = 0.28;
    prism(B, x0 - o, x1 + o, z0 - o, z1 + o, h - 0.15, h + 0.35, [0, 0, 0, -2], trim, [ty, seed], [0, 0, 0, -1]);
    if (skyline) return;
    const ry = h + 0.35, w = x1 - x0, d = z1 - z0;
    if (r() < 0.65) for (let k = 1 + Math.floor(r() * 3); k > 0; k--)
      acs.push([x0 + 1.2 + r() * Math.max(0, w - 2.4), ry, z0 + 1.2 + r() * Math.max(0, d - 2.4), 1.2 + r() * 0.8, 0.8 + r() * 0.5, 1 + r() * 0.6]);
    if (floors >= 4 && floors <= 8 && w > 3.5 && d > 3.5 && r() < 0.45)
      tanks.push([x0 + 1.6 + r() * (w - 3.2), ry, z0 + 1.6 + r() * (d - 3.2), 0.9 + r() * 0.35]);
    if (shopGround && face !== 0) awnings.push([(x0 + x1) / 2, 3.25, face > 0 ? z1 + 0.65 : z0 - 0.65, w - 0.7, face, Math.floor(r() * AWN.length)]);
  };
  const xs = [CITY_BOUNDS.minX, ...STREETS_X, CITY_BOUNDS.maxX];
  const zs = [CITY_BOUNDS.minZ, ...STREETS_Z, CITY_BOUNDS.maxZ];
  const isX = (x: number) => (STREETS_X as readonly number[]).includes(x);
  const isZ = (z: number) => (STREETS_Z as readonly number[]).includes(z);
  const hit = (x0: number, x1: number, z0: number, z1: number) =>
    [HOME_LOT, SHOP_LOT].some((e) => x0 < e.maxX - 0.01 && x1 > e.minX + 0.01 && z0 < e.maxZ - 0.01 && z1 > e.minZ + 0.01);
  for (let c = 0; c < xs.length - 1; c++) for (let w = 0; w < zs.length - 1; w++) {
    const lx0 = xs[c] + (isX(xs[c]) ? LOT_SETBACK : 0), lx1 = xs[c + 1] - (isX(xs[c + 1]) ? LOT_SETBACK : 0);
    const lz0 = zs[w] + (isZ(zs[w]) ? LOT_SETBACK : 0), lz1 = zs[w + 1] - (isZ(zs[w + 1]) ? LOT_SETBACK : 0);
    const mid = (lz0 + lz1) / 2;
    const tall = c === 4 && w < 3;
    for (const [z0, z1, front] of [[mid, lz1, 1], [lz0, mid, 0]] as const) {
      const homeRow = c === 1 && w === 1 && front === 1;
      const zz0 = homeRow ? HOME_LOT.minZ : z0, zz1 = homeRow ? -11 : z1;
      const face = front === 1 ? (isZ(zs[w + 1]) ? 1 : 0) : isZ(zs[w]) ? -1 : 0;
      let x = lx0;
      while (lx1 - x > 0.5) {
        let wd = tall ? lx1 - x : 5.5 + r() * 6;
        if (lx1 - x - wd < 4) wd = lx1 - x;
        const x1 = x + wd;
        // split around hero lots so neighbors sit flush against them
        const segs: [number, number][] = [];
        let s = x;
        for (const e of [HOME_LOT, SHOP_LOT]) if (e.minZ < zz1 && e.maxZ > zz0 && e.minX < x1 && e.maxX > s) { if (e.minX > s) segs.push([s, e.minX]); s = e.maxX; }
        if (x1 > s) segs.push([s, x1]);
        for (const [a, b] of segs) {
          if (b - a < 1 || hit(a, b, zz0, zz1)) continue;
          const floors = tall ? 20 + Math.floor(r() * 25) : c === 1 && w === 1 ? 3 + Math.floor(r() * 2) : 3 + Math.floor(r() * (w === 3 ? 2 : 6));
          box(a, b, zz0, zz1, floors * 3.3 + 1.5, !homeRow && (w === 2 || r() < 0.4), floors, homeRow ? 0 : face);
        }
        x = x1;
      }
    }
  }
  // distant skyline ring beyond CITY_BOUNDS (skips the +z side where the camera sits)
  for (let cx = -280; cx <= 280; cx += 40) for (let cz = -300; cz <= 60; cz += 40) {
    if (Math.abs(cx) < 120 && cz > -100) continue;
    const s = 8 + r() * 4;
    box(cx - s, cx + s, cz - s, cz + s, 20 + r() * r() * 150, false, 0, 0, true);
  }
  return { near: toGeo(near), far: toGeo(far), glass: toGeo(glass), tanks, acs, awnings };
}

const VERT = (s: { vertexShader: string }) => {
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aFUv; attribute vec4 aGrid; attribute vec3 aWall; attribute vec2 aMat; varying vec2 vFUv; varying vec4 vGrid; varying vec3 vWall; varying vec3 vFN; varying vec2 vMat;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFUv = aFUv; vGrid = aGrid; vWall = aWall; vFN = normal; vMat = aMat;');
};
const FRAG_COMMON = `#include <common>
varying vec2 vFUv; varying vec4 vGrid; varying vec3 vWall; varying vec3 vFN; varying vec2 vMat;
float bh(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bh(i), bh(i + vec2(1.0, 0.0)), f.x), mix(bh(i + vec2(0.0, 1.0)), bh(i + vec2(1.0, 1.0)), f.x), f.y); }`;

function makeMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (s) => {
    VERT(s);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', FRAG_COMMON)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 col = vWall; float fR = 0.9; vec3 fE = vec3(0.0);
if (vGrid.w < -1.5) { col = vWall * (0.9 + 0.1 * vn(vFUv * 3.0)); fR = 0.8; }
else if (vFN.y > 0.5) { col = vec3(0.22, 0.22, 0.21) * (0.8 + 0.4 * bh(floor(vFUv * 2.0))); }
else {
  vec2 p = vFUv; float bay = vGrid.x, fl = vGrid.y, gH = vGrid.z, top = vGrid.w, ty = vMat.x, seed = vMat.y;
  float aa = clamp(length(fwidth(p)) * 5.0, 0.0, 1.0);
  if (ty < 0.5) {
    vec2 bs = vec2(0.44, 0.15);
    float row = floor(p.y / bs.y);
    vec2 q = vec2(p.x / bs.x + 0.5 * mod(row, 2.0), p.y / bs.y);
    vec2 f = fract(q);
    float mortar = 1.0 - step(0.07, f.x) * step(0.15, f.y);
    vec3 brick = col * (0.78 + 0.38 * bh(floor(q) + seed)) * (0.92 + 0.14 * vn(p * 3.0 + seed));
    vec3 mort = vec3(0.62, 0.6, 0.56);
    col = mix(mix(brick, mort, mortar), mix(col * (0.92 + 0.14 * vn(p * 3.0 + seed)), mort, 0.2), aa);
    fR = 0.95;
  } else if (ty < 1.5) {
    col *= 0.9 + 0.12 * vn(p * 0.7 + seed) + 0.05 * vn(p * 7.0);
    fR = 0.86;
  } else {
    vec2 bs = vec2(1.4, 0.7);
    float row = floor(p.y / bs.y);
    vec2 q = vec2(p.x / bs.x + 0.5 * mod(row, 2.0), p.y / bs.y);
    vec2 f = fract(q);
    float joint = 1.0 - step(0.02, f.x) * step(0.04, f.y);
    col *= 0.93 + 0.1 * bh(floor(q) + seed) + 0.05 * vn(p * 3.0);
    col = mix(col, col * 0.8, joint * (1.0 - aa));
    fR = 0.78;
  }
  // grime: darker toward the street, rain streaks running down from the roofline
  col *= mix(0.8, 1.0, smoothstep(0.0, 6.0, p.y));
  col *= 1.0 - 0.18 * vn(vec2(p.x * 1.3 + seed, p.y * 0.08)) * (1.0 - smoothstep(0.0, 10.0, top - p.y));
  if (p.y < gH) {
    float sw = 4.0; vec2 l = vec2(mod(p.x, sw), p.y);
    float glass = step(0.25, l.x) * step(l.x, sw - 0.25) * step(0.5, p.y) * step(p.y, gH - 1.1);
    vec3 inside = vec3(1.0, 0.85, 0.62) * 0.5;
    col = mix(mix(col, vec3(0.1, 0.11, 0.12), step(gH - 1.1, p.y)), inside, glass);
    fE = inside * 0.5 * glass; fR = mix(fR, 0.08, glass);
  } else if (p.y < top - 0.8 && p.x > 0.4) {
    vec2 cell = floor(vec2(p.x / bay, (p.y - gH) / fl));
    vec2 l = vec2(mod(p.x, bay), mod(p.y - gH, fl));
    vec2 a = vec2(bay * 0.25, fl * 0.3), b = vec2(bay * 0.75, fl * 0.85);
    float win = step(a.x, l.x) * step(l.x, b.x) * step(a.y, l.y) * step(l.y, b.y);
    float frame = win * (1.0 - step(a.x + 0.07, l.x) * step(l.x, b.x - 0.07) * step(a.y + 0.07, l.y) * step(l.y, b.y - 0.07));
    float sill = step(a.x - 0.08, l.x) * step(l.x, b.x + 0.08) * step(a.y - 0.1, l.y) * step(l.y, a.y);
    float rnd = bh(cell + seed);
    vec3 g = rnd < 0.15 ? vec3(1.0, 0.8, 0.55) * 0.6 : vec3(0.06, 0.075, 0.09);
    if (rnd < 0.15) fE = g * 0.7 * win;
    col = mix(col, vec3(0.8, 0.77, 0.7), sill);
    col = mix(col, mix(g, vec3(0.9, 0.88, 0.84), frame), win);
    fR = mix(fR, 0.06, win - frame);
  }
  // ambient occlusion at the ground and under the cornice
  col *= mix(0.5, 1.0, smoothstep(-0.2, 1.3, p.y)) * mix(0.7, 1.0, smoothstep(0.0, 0.8, top - p.y));
}
diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fR;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fE;');
  };
  return m;
}

function makeGlass() {
  const m = new THREE.MeshPhysicalMaterial({ color: '#1c3a40', metalness: 0.9, roughness: 0.12, envMapIntensity: 1.2 });
  m.onBeforeCompile = (s) => {
    VERT(s);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', FRAG_COMMON)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 gc = vec3(0.11, 0.22, 0.24); float gR = 0.1, gM = 0.9; vec3 gE = vec3(0.0);
if (vFN.y > 0.5) { gc = vec3(0.3, 0.3, 0.29); gR = 0.8; gM = 0.1; }
else {
  vec2 p = vFUv; vec2 c = vec2(p.x / 1.6, p.y / 3.6); vec2 f = fract(c);
  float mull = 1.0 - step(0.04, f.x) * step(f.x, 0.96) * step(0.03, f.y) * step(f.y, 0.97);
  float spand = step(f.y, 0.2);
  float rnd = bh(floor(c) + vMat.y);
  gc *= 0.8 + 0.4 * rnd;
  if (rnd > 0.93 && p.y > 5.0) gE = vec3(1.0, 0.85, 0.6) * 0.25 * (1.0 - mull);
  gc = mix(gc, vec3(0.06, 0.08, 0.09), spand * 0.85);
  gc = mix(gc, vec3(0.62, 0.65, 0.67), mull);
  if (p.y < 4.6) { gc = mix(gc, vec3(0.55, 0.47, 0.35), 0.35 * (1.0 - mull)); gE += vec3(1.0, 0.85, 0.6) * 0.12 * (1.0 - mull); }
  gR = mix(0.08, 0.35, mull); gM = mix(0.9, 0.55, mull);
  gc *= mix(0.6, 1.0, smoothstep(-0.2, 1.2, p.y));
}
diffuseColor.rgb = gc;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gR;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gM;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gE;');
  };
  return m;
}

function inst(geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cols?: THREE.Color[]) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, ms.length));
  im.count = ms.length;
  ms.forEach((m, i) => im.setMatrixAt(i, m));
  cols?.forEach((c, i) => im.setColorAt(i, c));
  im.castShadow = true; im.receiveShadow = true;
  return im;
}

function clutter(d: ReturnType<typeof build>) {
  const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
  const body: THREE.Matrix4[] = [], cone: THREE.Matrix4[] = [], legs: THREE.Matrix4[] = [], ac: THREE.Matrix4[] = [], aw: THREE.Matrix4[] = [], awC: THREE.Color[] = [];
  for (const [x, y, z, s] of d.tanks) {
    body.push(M(x, y + 1.4 + 1.1 * s, z, s, s, s));
    cone.push(M(x, y + 1.4 + 2.2 * s + 0.35 * s, z, s, s, s));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) legs.push(M(x + dx * 0.65 * s, y + 0.75, z + dz * 0.65 * s, 1, 1.5, 1));
  }
  for (const [x, y, z, sx, sy, sz] of d.acs) ac.push(M(x, y + sy / 2, z, sx, sy, sz));
  for (const [x, y, z, w, face, ci] of d.awnings) { aw.push(M(x, y, z, w, 0.14, 1.3, face * 0.22)); awC.push(new THREE.Color(AWN[ci])); }
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5638', roughness: 0.92 });
  const woodRoof = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: '#3a3c3e', roughness: 0.6, metalness: 0.5 });
  const acMat = new THREE.MeshStandardMaterial({ color: '#b9bcbd', roughness: 0.55, metalness: 0.3 });
  const awMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
  return [
    inst(new THREE.CylinderGeometry(1, 1, 2.2, 16), wood, body),
    inst(new THREE.ConeGeometry(1.1, 0.7, 16), woodRoof, cone),
    inst(new THREE.BoxGeometry(0.14, 1.5, 0.14), metal, legs),
    inst(new THREE.BoxGeometry(1, 1, 1), acMat, ac),
    inst(new THREE.BoxGeometry(1, 1, 1), awMat, aw, awC),
  ];
}

export default function CityBuildings() {
  const d = useMemo(build, []);
  const mat = useMemo(makeMaterial, []);
  const glass = useMemo(makeGlass, []);
  const extras = useMemo(() => clutter(d), [d]);
  return (
    <group>
      <mesh geometry={d.near} material={mat} castShadow receiveShadow />
      <mesh geometry={d.far} material={mat} receiveShadow />
      <mesh geometry={d.glass} material={glass} receiveShadow />
      {extras.map((o, i) => <primitive key={i} object={o} />)}
    </group>
  );
}
