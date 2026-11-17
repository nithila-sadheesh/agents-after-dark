// Street-network layout helpers (OWNER: roads). Pure data derived from shared/world.ts.
import { CITY_BOUNDS, EDGES, ROAD_WIDTH, SIDEWALK_WIDTH, STREETS_X, STREETS_Z, WAYPOINTS } from '../../../../shared/world';

/** Asphalt surface height. Sidewalks and block interiors (lots) are raised by a 0.15m curb. */
export const ROAD_Y = 0;
export const SIDEWALK_TOP = 0.15;
export const CURB_R = 2.5;      // curb-return radius at block corners
export const CURB_W = 0.18;     // width of the curb stone
export const HALF_ROAD = ROAD_WIDTH / 2;              // 5: curb line from centerline
export const CURB_ZONE = HALF_ROAD + 0.55;            // furniture next to the curb
export const BLDG_ZONE = HALF_ROAD + SIDEWALK_WIDTH - 0.45; // furniture next to the building line
export const CROSSWALK_C = HALF_ROAD + 1.5;           // crosswalk centre distance from the cross street centerline (6.5)
export const CROSSWALK_W = 3;

/** Approximate walkable ground height (sidewalk/lot vs road; ramps at the robot's crosswalks). */
export function groundY(x: number, z: number) {
  const dx = Math.min(...STREETS_X.map((s) => Math.abs(x - s)));
  const dz = Math.min(...STREETS_Z.map((s) => Math.abs(z - s)));
  return dx < HALF_ROAD || dz < HALF_ROAD ? ROAD_Y : SIDEWALK_TOP;
}

const xsB = [CITY_BOUNDS.minX, ...STREETS_X, CITY_BOUNDS.maxX];
const zsB = [CITY_BOUNDS.minZ, ...STREETS_Z, CITY_BOUNDS.maxZ];
const isStreetX = (v: number) => (STREETS_X as readonly number[]).includes(v);
const isStreetZ = (v: number) => (STREETS_Z as readonly number[]).includes(v);

export interface Block {
  minX: number; maxX: number; minZ: number; maxZ: number; // curb line (outer edge of sidewalk)
  sx0: boolean; sx1: boolean; sz0: boolean; sz1: boolean; // which sides face a street
}

export const BLOCKS: Block[] = [];
for (let i = 0; i < xsB.length - 1; i++) for (let j = 0; j < zsB.length - 1; j++) {
  const sx0 = isStreetX(xsB[i]), sx1 = isStreetX(xsB[i + 1]), sz0 = isStreetZ(zsB[j]), sz1 = isStreetZ(zsB[j + 1]);
  BLOCKS.push({
    minX: xsB[i] + (sx0 ? HALF_ROAD : 0), maxX: xsB[i + 1] - (sx1 ? HALF_ROAD : 0),
    minZ: zsB[j] + (sz0 ? HALF_ROAD : 0), maxZ: zsB[j + 1] - (sz1 ? HALF_ROAD : 0),
    sx0, sx1, sz0, sz1,
  });
}

/** A straight run of sidewalk along one side of a street, between two cross streets (or a street and the bounds). */
export interface Run {
  axis: 'x' | 'z';   // 'z' = street runs along z (a STREETS_X street); 'x' = runs along x
  c: number;         // street centerline coordinate
  side: 1 | -1;      // which side of the centerline
  a: number; b: number; // along-street extent of the sidewalk
  ia: boolean; ib: boolean; // ends that meet an intersection
}
export const RUNS: Run[] = [];
for (const c of STREETS_X) for (const side of [1, -1] as const) for (let j = 0; j < zsB.length - 1; j++) {
  const ia = isStreetZ(zsB[j]), ib = isStreetZ(zsB[j + 1]);
  RUNS.push({ axis: 'z', c, side, a: zsB[j] + (ia ? HALF_ROAD : 0), b: zsB[j + 1] - (ib ? HALF_ROAD : 0), ia, ib });
}
for (const c of STREETS_Z) for (const side of [1, -1] as const) for (let i = 0; i < xsB.length - 1; i++) {
  const ia = isStreetX(xsB[i]), ib = isStreetX(xsB[i + 1]);
  RUNS.push({ axis: 'x', c, side, a: xsB[i] + (ia ? HALF_ROAD : 0), b: xsB[i + 1] - (ib ? HALF_ROAD : 0), ia, ib });
}

/** World position + yaw for a point on a run. `off` = distance from the street centerline. Yaw faces the road. */
export function onRun(r: Run, along: number, off: number): { x: number; z: number; ry: number } {
  if (r.axis === 'z') return { x: r.c + r.side * off, z: along, ry: r.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
  return { x: along, z: r.c + r.side * off, ry: r.side > 0 ? Math.PI : 0 };
}

// ---- Robot corridor: nothing may be placed within 0.8m (+ object radius) of the route polyline ----
const SEGS = EDGES.map(([a, b]) => [WAYPOINTS[a], WAYPOINTS[b]] as const);
export function routeDist(x: number, z: number) {
  let best = Infinity;
  for (const [p, q] of SEGS) {
    const vx = q[0] - p[0], vz = q[2] - p[2];
    const t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (z - p[2]) * vz) / (vx * vx + vz * vz || 1)));
    best = Math.min(best, Math.hypot(x - p[0] - vx * t, z - p[2] - vz * t));
  }
  return best;
}
export const clearOfRoute = (x: number, z: number, radius: number) => routeDist(x, z) > 0.8 + radius;

export const NAMES_X: Record<number, string> = { [-60]: 'LARKIN ST', [-20]: 'POLK ST', [20]: 'VAN NESS AVE', [60]: 'FRANKLIN ST' };
export const NAMES_Z: Record<number, string> = { [-40]: 'BUSH ST', [0]: 'PINE ST', [40]: 'CALIFORNIA ST' };

/** Deterministic PRNG. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
