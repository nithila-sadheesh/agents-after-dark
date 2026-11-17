// Fixed city layout + waypoint graph (PRD §9.4). Y is up. Robot model faces +Z at heading 0;
// heading = Math.atan2(dx, dz). Units ≈ meters.
import type { RobotPlan, SceneSpec, Vec3 } from './types';

export const ROBOT_ID = 'buggy-01';

// ---------------- City layout (units ≈ meters, Y up, +Z faces the default camera) ----------------
// A street grid. Streets running north–south sit at x ∈ STREETS_X; streets running east–west sit at z ∈ STREETS_Z.
// Each street is ROAD_WIDTH curb-to-curb, flanked by SIDEWALK_WIDTH sidewalks, so building lots start
// LOT_SETBACK (= ROAD_WIDTH/2 + SIDEWALK_WIDTH) from a street centerline. Blocks are the rectangles between streets.
// Right-hand traffic: lane centers sit LANE_OFFSET either side of a centerline (eastbound at z+LANE_OFFSET,
// westbound at z-LANE_OFFSET, southbound(+z) at x-LANE_OFFSET, northbound(-z) at x+LANE_OFFSET).
export const STREETS_X = [-60, -20, 20, 60] as const;
export const STREETS_Z = [-40, 0, 40] as const;
export const ROAD_WIDTH = 10;
export const SIDEWALK_WIDTH = 3;
export const LOT_SETBACK = ROAD_WIDTH / 2 + SIDEWALK_WIDTH; // 8
export const LANE_OFFSET = 2.5;
export const CITY_BOUNDS = { minX: -100, maxX: 100, minZ: -80, maxZ: 80 } as const; // fill buildings to here (skyline fades into haze beyond)
export const INTERSECTIONS: Vec3[] = STREETS_X.flatMap((x) => STREETS_Z.map((z) => [x, 0, z] as Vec3));

/** Axis-aligned rect on the ground plane. */
export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

// Hero lots — CityBuildings must leave these empty (neighbors may abut them).
// Home: a narrow city townhouse/brownstone on the block x∈(-60,-20), z∈(-40,0); facade at z=-11 facing +Z (street z=0),
// with a 3m front stoop/yard z∈[-11,-8] before the sidewalk.
export const HOME_LOT: Rect = { minX: -46, maxX: -34, minZ: -26, maxZ: -8 };
export const HOME_ANCHOR: Vec3 = [-40, 0, -18.5];   // footprint center; front door at (-40, 0, -11)
export const HOME_FACADE_Z = -11;
// Shop: ground-floor dry-cleaner storefront on the block x∈(-20,20), z∈(0,40); facade right at the property line z=32,
// facing +Z (street z=40).
export const SHOP_LOT: Rect = { minX: -9, maxX: 9, minZ: 15, maxZ: 32 };
export const SHOP_ANCHOR: Vec3 = [0, 0, 24];        // footprint center; front door at (0, 0, 32)
export const SHOP_FACADE_Z = 32;

// Robot route graph. The robot drives on SIDEWALKS (sidewalk centerline = 6.5 from a street centerline) and crosses
// streets on crosswalks. The only path home→shop is the chain below: 4 corner turns + 2 crosswalk crossings.
export type WaypointId =
  | 'home' | 'laundry_pickup' | 'driveway' | 'corner_a' | 'corner_b'
  | 'intersection' | 'corner_c' | 'shop_curb' | 'dry_cleaner';

export const WAYPOINTS: Record<WaypointId, Vec3> = {
  home: [-36.8, 0, -9.4],          // robot parking spot in the townhouse front yard (faces the house: heading π)
  laundry_pickup: [-40, 0, -9.2],  // walkway at the foot of the stoop, next to the laundry bag
  driveway: [-40, 0, -6.5],        // sidewalk in front of the house (id kept for planner compatibility)
  corner_a: [-26.5, 0, -6.5],      // NW corner of intersection (-20, 0)
  corner_b: [-26.5, 0, 6.5],       // SW corner — reached by crossing street z=0 on the west crosswalk
  intersection: [-13.5, 0, 6.5],   // SE corner — reached by crossing street x=-20 on the south crosswalk
  corner_c: [-13.5, 0, 33.5],      // NE corner of intersection (-20, 40)
  shop_curb: [-5, 0, 33.5],        // sidewalk approaching the shop
  dry_cleaner: [0, 0, 33.4],       // drop-off spot on the sidewalk at the shop door
};

export const EDGES: [WaypointId, WaypointId][] = [
  ['home', 'laundry_pickup'],
  ['home', 'driveway'],
  ['laundry_pickup', 'driveway'],
  ['driveway', 'corner_a'],
  ['corner_a', 'corner_b'],
  ['corner_b', 'intersection'],
  ['intersection', 'corner_c'],
  ['corner_c', 'shop_curb'],
  ['shop_curb', 'dry_cleaner'],
];

/** Crosswalks the robot uses (center, and the axis the robot travels along while crossing). Roads may add zebra
 *  crossings on every intersection leg; these two must exist. */
export const ROBOT_CROSSWALKS: { center: Vec3; axis: 'x' | 'z' }[] = [
  { center: [-26.5, 0, 0], axis: 'z' },   // crossing street z=0, west leg of intersection (-20,0)
  { center: [-20, 0, 6.5], axis: 'x' },   // crossing street x=-20, south leg of intersection (-20,0)
];

// Plan targets that map onto waypoints (corner_* are internal and not plan targets).
export const TARGET_ALIASES: Record<string, WaypointId> = {
  home: 'home', parking: 'home',
  laundry_pickup: 'laundry_pickup', porch: 'laundry_pickup', home_delivery_zone: 'laundry_pickup',
  driveway: 'driveway', intersection: 'intersection', shop_curb: 'shop_curb',
  dry_cleaner: 'dry_cleaner', dropoff_zone: 'dry_cleaner', shop: 'dry_cleaner', store: 'dry_cleaner',
};

// Item ids valid for PICK_UP.
export const ITEM_TARGETS = ['laundry_bag', 'clean_laundry', 'package', 'item'] as const;

// Where the item rests when not on the robot.
export const ITEM_SPOTS: Record<'home' | 'shop', Vec3> = {
  home: [-41.5, 0, -10.2],  // at the foot of the stoop, left of the walkway
  shop: [1.8, 0, 32.7],     // on the sidewalk beside the shop door
};

export function resolveWaypoint(target: string | undefined): WaypointId | null {
  if (!target) return null;
  return TARGET_ALIASES[target.trim().toLowerCase()] ?? null;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Shortest path (Dijkstra) over the waypoint graph. Returns waypoint ids including both ends. */
export function findRoute(from: WaypointId, to: WaypointId): WaypointId[] {
  if (from === to) return [from];
  const ids = Object.keys(WAYPOINTS) as WaypointId[];
  const d = new Map<WaypointId, number>(ids.map((i) => [i, Infinity]));
  const prev = new Map<WaypointId, WaypointId>();
  const open = new Set(ids);
  d.set(from, 0);
  while (open.size) {
    let u: WaypointId | null = null;
    for (const i of open) if (u === null || d.get(i)! < d.get(u)!) u = i;
    if (u === null || d.get(u) === Infinity) break;
    open.delete(u);
    if (u === to) break;
    for (const [a, b] of EDGES) {
      const v = a === u ? b : b === u ? a : null;
      if (!v || !open.has(v)) continue;
      const alt = d.get(u)! + dist(WAYPOINTS[u], WAYPOINTS[v]);
      if (alt < d.get(v)!) { d.set(v, alt); prev.set(v, u); }
    }
  }
  const path: WaypointId[] = [to];
  while (path[0] !== from) {
    const p = prev.get(path[0]);
    if (!p) return [from, to];
    path.unshift(p);
  }
  return path;
}

export const routePoints = (route: WaypointId[]): Vec3[] => route.map((id) => WAYPOINTS[id]);

/** Illustrative plan from PRD §9.2 — used for presentation mode and as the fallback. */
export const DEMO_PLAN: RobotPlan = {
  taskId: 'dry-cleaning-001',
  objective: 'Take clothes to the dry cleaner and bring them back clean',
  robotId: ROBOT_ID,
  steps: [
    { action: 'MOVE_TO', target: 'laundry_pickup' },
    { action: 'PICK_UP', target: 'laundry_bag' },
    { action: 'MOVE_TO', target: 'dry_cleaner' },
    { action: 'DROP_OFF', target: 'dropoff_zone' },
    { action: 'WAIT', durationMs: 4000, message: 'Cleaning in progress' },
    { action: 'PICK_UP', target: 'clean_laundry' },
    { action: 'RETURN_HOME' },
    { action: 'DROP_OFF', target: 'home_delivery_zone' },
  ],
};

export const DEFAULT_SCENE: SceneSpec = {
  environment: 'suburban_neighborhood',
  camera: 'isometric',
  shopLabel: 'DRY CLEANERS',
  itemKind: 'laundry_bag',
  accent: '#7c9cff',
  objects: [
    { id: 'home', type: 'house', position: HOME_ANCHOR, color: '#f2e8cf' },
    { id: 'shop', type: 'store', position: SHOP_ANCHOR, label: 'DRY CLEANERS', color: '#a8dadc' },
  ],
};

export const PACKAGE_SCENE: SceneSpec = {
  ...DEFAULT_SCENE,
  shopLabel: 'SHIP & POST',
  itemKind: 'package',
  accent: '#ffb86b',
  objects: DEFAULT_SCENE.objects.map((o) =>
    o.id === 'shop' ? { ...o, label: 'SHIP & POST', color: '#ffd6a5' } : o),
};
