// Sidewalk-robot motion planning: turns a waypoint polyline into a smooth drivable path (filleted corners,
// stop-and-pivot at hairpins) with a curvature-limited speed profile, soft starts/stops and curb stops before
// crosswalks. Pure functions (no store, no timing) so the executor can play them back and tests can run headless.
import type { Vec3 } from '../../shared/types';
import { ROAD_WIDTH, ROBOT_CROSSWALKS } from '../../shared/world';

const DS = 0.05;            // sample spacing along the path (m)
export const CRUISE = 6;  // m/s on straights (demo pacing)
const V_CROSS = 4.5;        // m/s on a crosswalk
const A_LAT = 2.8;          // lateral accel cap (m/s²) → corner speed √(A_LAT·R) ≈ 2 m/s at R = 1.6
const ACCEL = 3.2;          // m/s²
const DECEL = 3.6;          // m/s²
const R_CORNER = 1.6;       // fillet radius at sidewalk corners (m)
const R_CURB = 1.2;         // tighter fillet next to a crosswalk so the robot squares up before the curb
const PIVOT_ANGLE = 1.75;   // corners sharper than ~100° become stop → turn in place → go
const STOP_GAP = 0.75;      // robot center to curb line while waiting (body is ~1.36 m long)
const ALIGN_TOL = 0.21;     // ~12°: the robot waits once it is (nearly) facing across the street
const CLEAR_GAP = 0.9;      // crossing counts as done once the center is this far past the far curb
const HOLD_GAP = 6;         // a second crossing this close after the first keeps the "crossing" phase going
const TURN_LEAD = 2.5;      // "turning" cue starts this far before an arc…
const TURN_TAIL = 2;        // …and ends this far after it

type P = [number, number]; // (x, z)

/** Sample-index ranges. `stop` is where the robot waits at the curb; `clear` is where it is across. */
export interface Crossing { stop: number; clear: number }
export interface Corner { from: number; to: number; dir: 'left' | 'right'; curb: boolean }
/** One pivot-free stretch of path, densely sampled. t = arrival time (s) at each sample, with v = 0 at the
 *  start, the end and every crossing stop. */
export interface Leg {
  n: number; length: number;
  s: Float64Array; x: Float64Array; z: Float64Array; h: Float64Array; v: Float64Array; t: Float64Array;
  crossings: Crossing[]; corners: Corner[];
}
export interface Route { legs: Leg[]; points: Vec3[]; length: number }

const sub = (a: P, b: P): P => [b[0] - a[0], b[1] - a[1]];
const norm = (a: P): P => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const deflection = (a: P, b: P, c: P) => {
  const u = norm(sub(a, b)), v = norm(sub(b, c));
  return Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
};
/** Signed shortest angular difference b - a, in (-PI, PI]. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

type Prim =
  | { kind: 'line'; x: number; z: number; dx: number; dz: number; len: number }
  | { kind: 'arc'; cx: number; cz: number; r: number; a0: number; sweep: number; len: number; dir: Corner['dir']; curb: boolean };

type Cw = (typeof ROBOT_CROSSWALKS)[number];

/** The robot crosswalk that segment a→b runs across, if any. */
function crosswalkOn(a: P, b: P): Cw | null {
  const d = sub(a, b), len = Math.hypot(d[0], d[1]);
  if (len < 1e-6) return null;
  for (const c of ROBOT_CROSSWALKS) {
    if ((c.axis === 'z') !== (Math.abs(d[1]) > Math.abs(d[0]))) continue;
    const w: P = [c.center[0] - a[0], c.center[2] - a[1]];
    const along = (w[0] * d[0] + w[1] * d[1]) / len;
    const perp = Math.abs(w[0] * d[1] - w[1] * d[0]) / len;
    if (perp < 1 && along > 0 && along < len) return c;
  }
  return null;
}

function buildLeg(raw: P[]): Leg {
  const p: P[] = [];
  for (const q of raw) {
    const l = p[p.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-3) p.push(q);
  }
  for (let i = 1; i < p.length - 1;) if (deflection(p[i - 1], p[i], p[i + 1]) < 0.03) p.splice(i, 1); else i++;
  if (p.length === 1) p.push([p[0][0], p[0][1]]);

  const m = p.length;
  const u: P[] = [], L: number[] = [], cw: (Cw | null)[] = [];
  for (let j = 0; j < m - 1; j++) {
    const d = sub(p[j], p[j + 1]);
    L.push(Math.hypot(d[0], d[1]));
    u.push(norm(d));
    cw.push(crosswalkOn(p[j], p[j + 1]));
  }

  // Corner fillets: tangent length T = R·tan(θ/2), shrunk to fit the neighbouring segments.
  const th = new Array<number>(m).fill(0), T = new Array<number>(m).fill(0);
  for (let i = 1; i < m - 1; i++) {
    th[i] = deflection(p[i - 1], p[i], p[i + 1]);
    T[i] = (cw[i - 1] || cw[i] ? R_CURB : R_CORNER) * Math.tan(th[i] / 2);
  }
  for (let j = 0; j < m - 1; j++) {
    const limit = Math.max(0, L[j] - (j === 0 ? 0.3 : 0) - (j === m - 2 ? 0.3 : 0));
    const sum = T[j] + T[j + 1];
    if (sum > limit) { T[j] *= limit / sum; T[j + 1] *= limit / sum; }
  }

  const prims: Prim[] = [];
  let cur: P = p[0];
  for (let j = 0; j < m - 1; j++) {
    const e = T[j + 1];
    const end: P = [p[j + 1][0] - u[j][0] * e, p[j + 1][1] - u[j][1] * e];
    const len = Math.hypot(end[0] - cur[0], end[1] - cur[1]);
    if (len > 1e-6) prims.push({ kind: 'line', x: cur[0], z: cur[1], dx: u[j][0], dz: u[j][1], len });
    cur = end;
    if (j + 1 < m - 1 && e > 1e-6) {
      const v = u[j + 1];
      const cross = u[j][0] * v[1] - u[j][1] * v[0];
      const sg = cross >= 0 ? 1 : -1;
      const r = e / Math.tan(th[j + 1] / 2);
      const cx = end[0] - sg * u[j][1] * r, cz = end[1] + sg * u[j][0] * r;
      prims.push({
        kind: 'arc', cx, cz, r, a0: Math.atan2(end[1] - cz, end[0] - cx), sweep: sg * th[j + 1], len: r * th[j + 1],
        dir: cross > 0 ? 'right' : 'left', curb: !!(cw[j] || cw[j + 1]),
      });
      cur = [p[j + 1][0] + v[0] * e, p[j + 1][1] + v[1] * e];
    }
  }

  // Dense samples (uniform spacing ≤ DS) with per-sample speed caps.
  const length = prims.reduce((a, q) => a + q.len, 0);
  const n = Math.max(2, Math.ceil(length / DS) + 1);
  const s = new Float64Array(n), x = new Float64Array(n), z = new Float64Array(n), h = new Float64Array(n);
  const vmax = new Float64Array(n);
  const corners: Corner[] = [];
  const arcAt: { a: number; b: number; prim: Prim & { kind: 'arc' } }[] = [];
  let pi = 0, base = 0;
  for (let k = 0; k < n; k++) {
    const sk = (length * k) / (n - 1);
    while (pi < prims.length - 1 && sk > base + prims[pi].len) { base += prims[pi].len; pi++; }
    const q = prims[pi];
    s[k] = sk;
    if (!q) { x[k] = p[0][0]; z[k] = p[0][1]; h[k] = 0; continue; }
    const d = Math.min(q.len, Math.max(0, sk - base));
    if (q.kind === 'line') {
      x[k] = q.x + q.dx * d; z[k] = q.z + q.dz * d; h[k] = Math.atan2(q.dx, q.dz);
      vmax[k] = CRUISE;
    } else {
      const a = q.a0 + q.sweep * (d / q.len), sg = Math.sign(q.sweep);
      x[k] = q.cx + q.r * Math.cos(a); z[k] = q.cz + q.r * Math.sin(a);
      h[k] = Math.atan2(-sg * Math.sin(a), sg * Math.cos(a));
      vmax[k] = Math.min(CRUISE, Math.sqrt(A_LAT * q.r));
      const last = arcAt[arcAt.length - 1];
      if (last && last.prim === q) last.b = k; else arcAt.push({ a: k, b: k, prim: q });
    }
  }
  const idxAt = (sv: number) => Math.max(0, Math.min(n - 1, Math.round((sv / length) * (n - 1)) || 0));
  for (const { a, b, prim } of arcAt) {
    corners.push({ from: idxAt(s[a] - TURN_LEAD), to: idxAt(s[b] + TURN_TAIL), dir: prim.dir, curb: prim.curb });
  }

  // Crosswalks: wait at the near curb (squared up), cap speed on the asphalt.
  const crossings: Crossing[] = [];
  let from = 0;
  for (let j = 0; j < m - 1; j++) {
    const c = cw[j];
    if (!c) continue;
    const ax = c.axis === 'x' ? 0 : 1, sg = Math.sign(u[j][ax]);
    const coord = (k: number) => (ax === 0 ? x[k] : z[k]);
    const inBand = (k: number) => Math.abs((ax === 0 ? z[k] : x[k]) - (ax === 0 ? c.center[2] : c.center[0])) < 2.5;
    const near = c.center[ax === 0 ? 0 : 2] - sg * ROAD_WIDTH / 2;
    const far = near + sg * ROAD_WIDTH;
    const facing = c.axis === 'z' ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI / 2 : -Math.PI / 2);
    let stop = from;
    while (stop < n - 1 && !(inBand(stop) && sg * (coord(stop) - near) >= -STOP_GAP)) stop++;
    while (stop < n - 1 && Math.abs(angleDelta(h[stop], facing)) > ALIGN_TOL && sg * (coord(stop) - near) < 0) stop++;
    if (s[stop] < 1.5) stop = 0;
    let clear = stop;
    while (clear < n - 1 && !(sg * (coord(clear) - far) >= CLEAR_GAP)) clear++;
    for (let k = 0; k < n; k++) {
      if (inBand(k) && sg * (coord(k) - near) >= -0.5 && sg * (coord(k) - far) <= 0.7) vmax[k] = Math.min(vmax[k], V_CROSS);
    }
    const prev = crossings[crossings.length - 1];
    if (prev && s[stop] - s[prev.clear] < HOLD_GAP) prev.clear = stop;
    crossings.push({ stop, clear });
    from = clear;
  }
  for (const c of crossings) vmax[c.stop] = 0;
  vmax[0] = 0; vmax[n - 1] = 0;

  // Speed profile: forward (accel) + backward (decel) passes; accel eases in near standstill for soft starts/stops.
  const soft = (a: number, v: number) => a * (0.3 + 0.7 * Math.min(1, v / 1.2));
  const v = new Float64Array(n);
  for (let k = 0; k < n - 1; k++) {
    const ds = s[k + 1] - s[k];
    v[k + 1] = Math.min(vmax[k + 1], Math.sqrt(v[k] * v[k] + 2 * soft(ACCEL, v[k]) * ds));
  }
  for (let k = n - 2; k >= 0; k--) {
    const ds = s[k + 1] - s[k];
    v[k] = Math.min(v[k], Math.sqrt(v[k + 1] * v[k + 1] + 2 * soft(DECEL, v[k + 1]) * ds));
  }
  const t = new Float64Array(n);
  for (let k = 0; k < n - 1; k++) t[k + 1] = t[k] + (2 * (s[k + 1] - s[k])) / Math.max(1e-3, v[k] + v[k + 1]);

  return { n, length, s, x, z, h, v, t, crossings, corners };
}

/** Smooth drivable route through waypoint positions. Hairpin corners split it into legs (turn in place between). */
export function planRoute(pts: Vec3[]): Route {
  const P: P[] = [];
  for (const q of pts) {
    const l = P[P.length - 1];
    if (!l || Math.hypot(q[0] - l[0], q[2] - l[1]) > 1e-3) P.push([q[0], q[2]]);
  }
  const legs: Leg[] = [];
  if (P.length >= 2) {
    let start = 0;
    for (let i = 1; i < P.length - 1; i++) {
      if (deflection(P[i - 1], P[i], P[i + 1]) > PIVOT_ANGLE) { legs.push(buildLeg(P.slice(start, i + 1))); start = i; }
    }
    legs.push(buildLeg(P.slice(start)));
  }
  const points: Vec3[] = [];
  for (const leg of legs) {
    for (let k = points.length ? 7 : 0; k < leg.n - 1; k += 7) points.push([leg.x[k], 0, leg.z[k]]);
    points.push([leg.x[leg.n - 1], 0, leg.z[leg.n - 1]]);
  }
  return { legs, points, length: legs.reduce((a, l) => a + l.length, 0) };
}

/** Pose at time tau (s) along a leg; returns the sample index just before. */
export function poseAt(leg: Leg, tau: number, out: { x: number; z: number; h: number }): number {
  const { t } = leg;
  let lo = 0, hi = leg.n - 1;
  if (tau <= 0) lo = hi = 0;
  else if (tau >= t[hi]) lo = hi;
  else while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= tau) lo = mid; else hi = mid; }
  const f = hi > lo ? (tau - t[lo]) / (t[hi] - t[lo]) : 0;
  out.x = leg.x[lo] + (leg.x[hi] - leg.x[lo]) * f;
  out.z = leg.z[lo] + (leg.z[hi] - leg.z[lo]) * f;
  out.h = leg.h[lo] + angleDelta(leg.h[lo], leg.h[hi]) * f;
  return lo;
}
