// Procedural PBR-ish textures for the street network (OWNER: roads). Generated once, cached.
import * as THREE from 'three';
import { NAMES_X, NAMES_Z, rng } from './layout';

type Ctx = CanvasRenderingContext2D;
const canvas = (w: number, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** Tileable value noise lattice of size `cells`, sampled bilinearly (smoothstep) at pixel res `n`. */
function tileNoise(n: number, cells: number, seed: number) {
  const r = rng(seed), lat = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const fy = (y / n) * cells, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
    const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < n; x++) {
      const fx = (x / n) * cells, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
      const c0 = x0 % cells, c1 = (x0 + 1) % cells;
      const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
      const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
      out[y * n + x] = a + (b - a) * sy;
    }
  }
  return out;
}
function fbm(n: number, seed: number, base = 4, oct = 4) {
  const acc = new Float32Array(n * n);
  let amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    const t = tileNoise(n, base << o, seed + o * 17);
    for (let i = 0; i < acc.length; i++) acc[i] += t[i] * amp;
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < acc.length; i++) acc[i] /= tot;
  return acc;
}

/** Draw `fn` at the 9 wrapped offsets so strokes tile seamlessly. */
const wrap = (n: number, fn: (ox: number, oy: number) => void) => {
  for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy);
};

function crackPath(g: Ctx, r: () => number, x: number, y: number, len: number, ang: number, step: number) {
  g.beginPath(); g.moveTo(x, y);
  for (let i = 0; i < len; i++) {
    ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * step; y += Math.sin(ang) * step; g.lineTo(x, y);
  }
  g.stroke();
}

/** Normal map from a height field (Float32 0..1). */
function normalFromHeight(h: Float32Array, n: number, strength: number) {
  const c = canvas(n), g = c.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x - 1 + n) % n)], rr = h[y * n + ((x + 1) % n)];
    const u = h[((y - 1 + n) % n) * n + x], dd = h[((y + 1) % n) * n + x];
    let nx = (l - rr) * strength, ny = (dd - u) * strength; const nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz); nx *= inv; ny *= inv;
    const i = (y * n + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * inv * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
const heightFromCanvas = (c: HTMLCanvasElement) => {
  const n = c.width, d = c.getContext('2d')!.getImageData(0, 0, n, n).data, h = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return h;
};

function tex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
export interface PBR { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

const cache = new Map<string, unknown>();
const memo = <T,>(k: string, f: () => T): T => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k) as T; };

// ------------------------------------------------------------------ asphalt (tile = 8m)
export const ASPHALT_TILE = 8;
export const asphaltTextures = () => memo('asphalt', (): PBR => {
  const n = 1024, r = rng(11);
  const low = fbm(n, 3, 3, 5), grit = fbm(n, 9, 64, 3);
  const col = canvas(n), g = col.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  const rough = canvas(n), gr = rough.getContext('2d')!, rimg = gr.createImageData(n, n), rd = rimg.data;
  for (let i = 0; i < n * n; i++) {
    const v = 50 + (low[i] - 0.5) * 22 + (grit[i] - 0.5) * 26 + (r() - 0.5) * 22;
    const warm = (low[i] - 0.5) * 4;
    d[i * 4] = v + warm + 1; d[i * 4 + 1] = v + warm * 0.6 + 1; d[i * 4 + 2] = v + 3; d[i * 4 + 3] = 255;
    const ro = 222 + (r() - 0.5) * 30 - (grit[i] - 0.5) * 30;
    rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = ro; rd[i * 4 + 3] = 255;
  }
  // exposed aggregate: light and dark stones
  for (let k = 0; k < 26000; k++) {
    const x = (r() * n) | 0, y = (r() * n) | 0, s = r() < 0.85 ? 1 : 2, bright = r() < 0.55;
    const v = bright ? 85 + r() * 50 : 22 + r() * 18;
    for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
      const i = (((y + yy) % n) * n + ((x + xx) % n)) * 4;
      d[i] = d[i + 1] = v; d[i + 2] = v + 2;
    }
  }
  g.putImageData(img, 0, 0); gr.putImageData(rimg, 0, 0);
  // repair patches (darker, smoother fresh asphalt) with sealed seams
  for (let k = 0; k < 3; k++) {
    const x = r() * n, y = r() * n, w = 120 + r() * 260, h = 90 + r() * 200;
    wrap(n, (ox, oy) => {
      g.fillStyle = `rgba(18,18,20,${0.32 + r() * 0.2})`; g.fillRect(x + ox, y + oy, w, h);
      g.strokeStyle = 'rgba(8,8,9,0.85)'; g.lineWidth = 5; g.strokeRect(x + ox, y + oy, w, h);
      gr.fillStyle = 'rgba(190,190,190,0.6)'; gr.fillRect(x + ox, y + oy, w, h);
      gr.strokeStyle = 'rgb(110,110,110)'; gr.lineWidth = 5; gr.strokeRect(x + ox, y + oy, w, h);
    });
  }
  // hairline cracks + "tar snake" crack sealant
  g.lineCap = gr.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = 0; k < 22; k++) {
    const x = r() * n, y = r() * n, a = r() * Math.PI * 2, len = 10 + r() * 40, tar = k < 6, seed = r() * 1e6;
    wrap(n, (ox, oy) => {
      const rr = rng(seed);
      g.strokeStyle = tar ? 'rgba(6,6,7,0.92)' : 'rgba(10,10,10,0.75)'; g.lineWidth = tar ? 7 + rr() * 4 : 1.3 + rr() * 1.2;
      crackPath(g, rr, x + ox, y + oy, len, a, 7);
      if (tar) { const r2 = rng(seed); r2(); gr.strokeStyle = 'rgb(90,90,90)'; gr.lineWidth = 9; crackPath(gr, r2, x + ox, y + oy, len, a, 7); }
    });
  }
  // oil / tire stains
  for (let k = 0; k < 14; k++) {
    const x = r() * n, y = r() * n, rad = 15 + r() * 70;
    wrap(n, (ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      grd.addColorStop(0, `rgba(8,7,6,${0.25 + r() * 0.3})`); grd.addColorStop(1, 'rgba(8,7,6,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, 7); g.fill();
      const gg = gr.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gg.addColorStop(0, 'rgba(120,120,120,0.7)'); gg.addColorStop(1, 'rgba(120,120,120,0)');
      gr.fillStyle = gg; gr.beginPath(); gr.arc(x + ox, y + oy, rad, 0, 7); gr.fill();
    });
  }
  const nrm = normalFromHeight(heightFromCanvas(col), n, 5);
  return { map: tex(col, true), normalMap: tex(nrm, false), roughnessMap: tex(rough, false) };
});

// ------------------------------------------------------------------ sidewalk concrete (tile = 6m = 4x4 slabs of 1.5m)
export const SIDEWALK_TILE = 6;
export const sidewalkTextures = () => memo('sidewalk', (): PBR => {
  const n = 1024, r = rng(23), slabs = 4, sp = n / slabs;
  const low = fbm(n, 5, 4, 5), fine = fbm(n, 6, 128, 2);
  const col = canvas(n), g = col.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  const tone = Array.from({ length: slabs * slabs }, () => [(r() - 0.5) * 18, (r() - 0.5) * 4]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, s = tone[((y / sp) | 0) * slabs + ((x / sp) | 0)];
    const broom = Math.sin(y * 0.9 + low[i] * 20) * 2.5;
    const v = 168 + s[0] + (low[i] - 0.5) * 34 + (fine[i] - 0.5) * 22 + (r() - 0.5) * 16 + broom;
    d[i * 4] = v + 3 + s[1]; d[i * 4 + 1] = v + 1; d[i * 4 + 2] = v - 3 - s[1]; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // stains, gum spots, hairline cracks
  for (let k = 0; k < 18; k++) {
    const x = r() * n, y = r() * n, rad = 10 + r() * 60;
    wrap(n, (ox, oy) => {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      grd.addColorStop(0, `rgba(70,62,52,${0.12 + r() * 0.18})`); grd.addColorStop(1, 'rgba(70,62,52,0)');
      g.fillStyle = grd; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
  for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(${40 + r() * 30},${40 + r() * 25},${40 + r() * 25},${0.35 + r() * 0.4})`;
    g.beginPath(); g.arc(r() * n, r() * n, 1.5 + r() * 3, 0, 7); g.fill();
  }
  g.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    g.strokeStyle = 'rgba(60,58,55,0.55)'; g.lineWidth = 1.2;
    crackPath(g, r, r() * n, r() * n, 8 + r() * 14, r() * 6.28, 9);
  }
  // expansion / control joints with grime and tooled edges
  for (let k = 0; k <= slabs; k++) {
    const p = k * sp;
    g.fillStyle = 'rgba(232,230,224,0.35)'; g.fillRect(p - 7, 0, 14, n); g.fillRect(0, p - 7, n, 14);
    g.fillStyle = 'rgba(55,52,48,0.55)'; g.fillRect(p - 4, 0, 8, n); g.fillRect(0, p - 4, n, 8);
    g.fillStyle = 'rgba(30,28,26,0.9)'; g.fillRect(p - 2, 0, 4, n); g.fillRect(0, p - 2, n, 4);
  }
  const h = heightFromCanvas(col);
  const rough = canvas(n), gr = rough.getContext('2d')!, rimg = gr.createImageData(n, n);
  for (let i = 0; i < h.length; i++) { const v = 215 + (fine[i] - 0.5) * 50 + (h[i] < 0.3 ? 25 : 0); rimg.data[i * 4] = rimg.data[i * 4 + 1] = rimg.data[i * 4 + 2] = v; rimg.data[i * 4 + 3] = 255; }
  gr.putImageData(rimg, 0, 0);
  return { map: tex(col, true), normalMap: tex(normalFromHeight(h, n, 3), false), roughnessMap: tex(rough, false) };
});

// ------------------------------------------------------------------ plaza pavers (tile = 4.8m, 0.6 x 0.3 running bond)
export const PLAZA_TILE = 4.8;
export const plazaTextures = () => memo('plaza', (): PBR => {
  const n = 1024, r = rng(37), cols = 8, rows = 16, pw = n / cols, ph = n / rows;
  const low = fbm(n, 8, 4, 4);
  const col = canvas(n), g = col.getContext('2d')!;
  g.fillStyle = '#5e5a55'; g.fillRect(0, 0, n, n);
  for (let j = 0; j < rows; j++) for (let i = -1; i < cols; i++) {
    const x = i * pw + (j % 2 ? pw / 2 : 0), y = j * ph, v = 150 + (r() - 0.5) * 34, w = (r() - 0.5) * 10;
    g.fillStyle = `rgb(${v + 6 + w},${v + 1},${v - 6 - w})`;
    g.fillRect(x + 3, y + 3, pw - 6, ph - 6);
    if (x < 0) g.fillRect(x + n + 3, y + 3, pw - 6, ph - 6);
  }
  const img = g.getImageData(0, 0, n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const k = (low[i] - 0.5) * 30 + (r() - 0.5) * 18; d[i * 4] += k; d[i * 4 + 1] += k; d[i * 4 + 2] += k; }
  g.putImageData(img, 0, 0);
  const h = heightFromCanvas(col);
  const rough = canvas(n), gr = rough.getContext('2d')!; gr.fillStyle = 'rgb(225,225,225)'; gr.fillRect(0, 0, n, n);
  return { map: tex(col, true), normalMap: tex(normalFromHeight(h, n, 2.5), false), roughnessMap: tex(rough, false) };
});

// ------------------------------------------------------------------ plain concrete (curbs, bases)
export const concreteTexture = () => memo('concrete', () => {
  const n = 256, r = rng(51), low = fbm(n, 12, 4, 4);
  const c = canvas(n), g = c.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = 190 + (low[i] - 0.5) * 40 + (r() - 0.5) * 22; d[i * 4] = v + 2; d[i * 4 + 1] = v; d[i * 4 + 2] = v - 3; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return tex(c, true);
});

// ------------------------------------------------------------------ paint wear (tile = 3m), used as map + alphaMap
export const PAINT_TILE = 3;
export const paintWearTexture = () => memo('paint', () => {
  const n = 512, r = rng(61), a = fbm(n, 21, 8, 4), b = fbm(n, 22, 64, 2);
  const c = canvas(n), g = c.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) {
    const v = Math.min(1, Math.max(0, 0.62 + (a[i] - 0.5) * 1.3 + (b[i] - 0.5) * 0.9 + (r() - 0.5) * 0.18));
    const c8 = v * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 150 + v * 105; d[i * 4 + 3] = c8;
  }
  g.putImageData(img, 0, 0);
  const t = tex(c, false);
  return t;
});

// ------------------------------------------------------------------ decal atlas 2x2: manhole | grate / tactile | utility
export const decalAtlas = () => memo('decals', () => {
  const n = 1024, h = n / 2, r = rng(71), c = canvas(n), g = c.getContext('2d')!;
  g.clearRect(0, 0, n, n);
  // manhole (0,0)
  { const cx = h / 2, cy = h / 2, R = h / 2 - 6;
    g.fillStyle = '#2b2927'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = '#4a4744'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, R - 8, 0, 7); g.stroke();
    g.strokeStyle = '#3c3936'; g.lineWidth = 5;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(cx, cy, (R - 20) * k / 5, 0, 7); g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20)); g.stroke(); }
    g.fillStyle = '#4b4743'; g.font = 'bold 34px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('SEWER', cx, cy + 12);
    for (let k = 0; k < 900; k++) { const a = r() * 7, rr = Math.sqrt(r()) * R; g.fillStyle = `rgba(${90 + r() * 60},${70 + r() * 30},${50},${0.15})`; g.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3, 3); } }
  // storm grate (1,0)
  { g.fillStyle = '#3a3734'; g.fillRect(h + 10, 60, h - 20, h - 120);
    g.fillStyle = '#060606'; for (let k = 0; k < 11; k++) g.fillRect(h + 34 + k * 40, 84, 22, h - 168);
    g.strokeStyle = '#4c4844'; g.lineWidth = 10; g.strokeRect(h + 15, 65, h - 30, h - 130); }
  // tactile warning pad (0,1)
  { g.fillStyle = '#d9a514'; g.fillRect(4, h + 4, h - 8, h - 8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const px = 36 + x * 63, py = h + 36 + y * 63;
      g.fillStyle = 'rgba(120,80,0,0.55)'; g.beginPath(); g.arc(px + 4, py + 5, 20, 0, 7); g.fill();
      g.fillStyle = '#f0c034'; g.beginPath(); g.arc(px, py, 19, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,240,180,0.6)'; g.beginPath(); g.arc(px - 6, py - 6, 6, 0, 7); g.fill();
    }
    for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(60,50,30,${r() * 0.25})`; g.fillRect(r() * h, h + r() * h, 4, 4); } }
  // utility plate (1,1)
  { g.fillStyle = '#4a4642'; g.fillRect(h + 20, h + 20, h - 40, h - 40);
    g.strokeStyle = '#5c5853'; g.lineWidth = 4;
    for (let k = -h; k < h; k += 28) { g.beginPath(); g.moveTo(h + 20 + k, h + 20); g.lineTo(h + 20 + k + h, n - 20); g.stroke(); g.beginPath(); g.moveTo(h + 20 + k + h, h + 20); g.lineTo(h + 20 + k, n - 20); g.stroke(); }
    g.strokeStyle = '#2a2826'; g.lineWidth = 12; g.strokeRect(h + 26, h + 26, h - 52, h - 52); }
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
});

// ------------------------------------------------------------------ street-name sign atlas (one row per street)
export const SIGN_NAMES = [...Object.values(NAMES_X), ...Object.values(NAMES_Z)];
export const signAtlas = () => memo('signs', () => {
  const w = 1024, rh = 128, c = canvas(w, rh * SIGN_NAMES.length), g = c.getContext('2d')!;
  SIGN_NAMES.forEach((name, i) => {
    const y = i * rh;
    g.fillStyle = '#0d6b3c'; g.fillRect(0, y, w, rh);
    g.strokeStyle = '#f2f2ee'; g.lineWidth = 6; g.strokeRect(10, y + 10, w - 20, rh - 20);
    g.fillStyle = '#f4f4f0'; g.font = 'bold 76px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, w / 2, y + rh / 2 + 4, w - 70);
  });
  const t = tex(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
});

// ------------------------------------------------------------------ bus shelter ad poster
export const posterTexture = () => memo('poster', () => {
  const c = canvas(256, 512), g = c.getContext('2d')!;
  g.fillStyle = '#f3efe6'; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#ff5a36'; g.fillRect(0, 0, 256, 300);
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(170, 140, 80, 0, 7); g.fill();
  g.fillStyle = '#1c3faa'; g.fillRect(30, 200, 120, 100);
  g.fillStyle = '#111'; g.font = 'bold 44px Helvetica, Arial, sans-serif'; g.fillText('CITY', 24, 370); g.fillText('MARKET', 24, 418);
  g.font = '22px Helvetica, Arial, sans-serif'; g.fillText('Open late. Every day.', 24, 460);
  return tex(c, true);
});
