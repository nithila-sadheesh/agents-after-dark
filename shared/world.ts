// Fixed neighborhood layout + waypoint graph (PRD §9.4). Y is up. Robot model faces +Z at heading 0;
// heading = Math.atan2(dx, dz). Units ≈ meters. Road runs along X at z = 3.
import type { RobotPlan, SceneSpec, Vec3 } from './types';

export const ROBOT_ID = 'buggy-01';

export const HOME_ANCHOR: Vec3 = [-10, 0, -4];   // house center; front door faces +Z at z ≈ -1.5
export const SHOP_ANCHOR: Vec3 = [10, 0, -4];    // store center; storefront faces +Z at z ≈ -1.5
export const ROAD_Z = 3;
export const ROAD_WIDTH = 3;
export const ROAD_X_EXTENT: [number, number] = [-24, 24];

export type WaypointId = 'home' | 'laundry_pickup' | 'driveway' | 'intersection' | 'shop_curb' | 'dry_cleaner';

export const WAYPOINTS: Record<WaypointId, Vec3> = {
  home: [-6.5, 0, 0.2],            // robot parking spot on the driveway
  laundry_pickup: [-9, 0, 0.6],    // in front of the porch, next to the laundry bag
  driveway: [-6.5, 0, ROAD_Z],     // driveway meets the road
  intersection: [0, 0, ROAD_Z],
  shop_curb: [10, 0, ROAD_Z],
  dry_cleaner: [10, 0, 0.6],       // drop-off zone in front of the shop door
};

export const EDGES: [WaypointId, WaypointId][] = [
  ['home', 'laundry_pickup'],
  ['home', 'driveway'],
  ['laundry_pickup', 'driveway'],
  ['driveway', 'intersection'],
  ['intersection', 'shop_curb'],
  ['shop_curb', 'dry_cleaner'],
];

// Plan targets that map onto waypoints.
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
  home: [-9.4, 0, -0.5],
  shop: [11.2, 0, -0.4],
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

const DECOR: SceneSpec['objects'] = [
  { id: 'tree-1', type: 'tree', position: [-15, 0, -6] },
  { id: 'tree-2', type: 'tree', position: [-4, 0, -7] },
  { id: 'tree-3', type: 'tree', position: [4, 0, -7], scale: 1.2 },
  { id: 'tree-4', type: 'tree', position: [16, 0, -6] },
  { id: 'tree-5', type: 'tree', position: [-14, 0, 8] },
  { id: 'tree-6', type: 'tree', position: [6, 0, 9], scale: 0.9 },
  { id: 'tree-7', type: 'tree', position: [18, 0, 8] },
  { id: 'bush-1', type: 'bush', position: [-12.5, 0, -1] },
  { id: 'bush-2', type: 'bush', position: [-7.5, 0, -1.5] },
  { id: 'bush-3', type: 'bush', position: [13, 0, -1] },
  { id: 'lamp-1', type: 'lamp', position: [-3, 0, 5] },
  { id: 'lamp-2', type: 'lamp', position: [5, 0, 5] },
  { id: 'lamp-3', type: 'lamp', position: [14, 0, 5] },
  { id: 'mailbox-1', type: 'mailbox', position: [-5.2, 0, 1.4] },
  { id: 'car-1', type: 'car', position: [-1, 0, 7], rotation: Math.PI / 2, color: '#e07a5f' },
  { id: 'car-2', type: 'car', position: [13.5, 0, 7], rotation: Math.PI / 2, color: '#81b29a' },
  { id: 'bench-1', type: 'bench', position: [7.5, 0, 0.8] },
];

export const DEFAULT_SCENE: SceneSpec = {
  environment: 'suburban_neighborhood',
  camera: 'isometric',
  shopLabel: 'DRY CLEANERS',
  itemKind: 'laundry_bag',
  accent: '#7c9cff',
  objects: [
    { id: 'home', type: 'house', position: HOME_ANCHOR, color: '#f2e8cf' },
    { id: 'shop', type: 'store', position: SHOP_ANCHOR, label: 'DRY CLEANERS', color: '#a8dadc' },
    ...DECOR,
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
