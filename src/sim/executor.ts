// Deterministic robot execution simulator: runs a validated RobotPlan step by step, animating robotPose
// and writing semantic events + workflow state to the store. No randomness, no network.
import type { PlanStep, RobotPlan, Vec3, WorkflowStage, WorldEventType } from '../../shared/types';
import { ROBOT_ID, WAYPOINTS, findRoute, resolveWaypoint, routePoints, type WaypointId } from '../../shared/world';
import { robotPose } from '../store';
import {
  addActivity, advance, angleDelta, animate, check, clamp, easeInOut, emit, get, set, setPosition, sleep,
} from './runtime';

const SPEED = 2.6;          // units / second (average over a leg)
const MIN_LEG_MS = 2000;   // short porch legs would otherwise flash by
const BEAT_MS = 1300;       // pickup / drop-off beat
const STEP_GAP_MS = 1000;   // breathing room between steps so each one reads on screen
const TURN_RATE = 0.012;    // heading smoothing (1/ms): ~80ms time constant → quick turns at corners
const LOOKAHEAD = 0.8;      // start turning slightly before a corner

const SHOP_SIDE: WaypointId[] = ['dry_cleaner', 'shop_curb'];
const STAGE_CHECKLIST: Partial<Record<WorkflowStage, string>> = {
  PICKING_UP: 'pickup', TRAVELING: 'travel', DROPPING_OFF: 'handoff', SERVICE_PENDING: 'service', RETURNING: 'return',
};

export interface ExecContext { token: number }

const legLength = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[2] - a[2]);
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Polyline of every leg the plan will drive (same walk as runPlan), for the pre-approval route preview. */
export function previewRoute(plan: RobotPlan): Vec3[] {
  let node: WaypointId = 'home';
  const pts: Vec3[] = [];
  const go = (dest: WaypointId | null) => {
    if (!dest || dest === node) return;
    for (const p of routePoints(findRoute(node, dest))) if (pts[pts.length - 1] !== p) pts.push(p);
    node = dest;
  };
  for (const s of plan.steps) {
    if (s.action === 'MOVE_TO' || s.action === 'DROP_OFF') go(resolveWaypoint(s.target));
    else if (s.action === 'RETURN_HOME') go('home');
  }
  go('home');
  return pts;
}

export async function runPlan(plan: RobotPlan, ctx: ExecContext): Promise<void> {
  const t = ctx.token;
  const robotId = plan.robotId || ROBOT_ID;
  const pkg = get().scene.itemKind === 'package';
  const shopName = titleCase(get().scene.shopLabel || 'the shop');
  let node: WaypointId = 'home';
  let pickedUp = false;

  const ev = (type: WorldEventType, extra: { target?: string; progress?: number; detail?: string } = {}) =>
    emit({ type, robotId, ...extra });
  const status = (text: string, moving = false) => set({ robot: { status: text, moving } });
  const stage = (s: WorkflowStage) => {
    set({ stage: s });
    const c = STAGE_CHECKLIST[s];
    if (c) advance(c);
  };
  const carrying = () => get().item.location === 'robot';
  const atShop = () => SHOP_SIDE.includes(node);

  function travelStage(dest: WaypointId): WorkflowStage {
    const [dx, nx] = [WAYPOINTS[dest][0], WAYPOINTS[node][0]];
    if (dx >= 0 && dx >= nx) return 'TRAVELING';
    return !carrying() && !pickedUp && get().item.location === 'home' ? 'PICKING_UP' : 'RETURNING';
  }

  function travelStatus(dest: WaypointId): string {
    if (dest === 'home') return 'Returning home';
    if (dest === 'laundry_pickup') {
      if (carrying()) return 'Delivering to the porch';
      return pkg ? 'Heading to the package' : 'Heading to laundry';
    }
    if (SHOP_SIDE.includes(dest)) return `Driving to ${shopName}`;
    return `Heading to the ${dest.replace(/_/g, ' ')}`;
  }

  async function drive(dest: WaypointId, label: string) {
    if (dest === node) return;
    const ids = findRoute(node, dest);
    const pts = routePoints(ids);
    const seg = pts.slice(1).map((p, i) => legLength(pts[i], p));
    const total = seg.reduce((a, b) => a + b, 0);
    const at = (d: number): Vec3 => {
      d = clamp(d, 0, total);
      for (let i = 0; i < seg.length; i++) {
        if (d <= seg[i] || i === seg.length - 1) {
          const k = seg[i] > 0 ? Math.min(1, d / seg[i]) : 1;
          const [a, b] = [pts[i], pts[i + 1]];
          return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
        }
        d -= seg[i];
      }
      return pts[pts.length - 1];
    };

    set({ route: pts, shopActive: false, robot: { status: label, moving: true }, camera: { mode: 'follow' } });
    ev('robot.moving', { target: dest, progress: 0, detail: ids.join(' → ') });
    let mark = 1;
    await animate(Math.max(MIN_LEG_MS, (total / SPEED) * 1000), t, (p, dt) => {
      const e = easeInOut(p);
      const d = e * total;
      const pos = at(d);
      setPosition(pos);
      const ahead = at(d + LOOKAHEAD);
      const [hx, hz] = [ahead[0] - pos[0], ahead[2] - pos[2]];
      if (hx * hx + hz * hz > 1e-4) {
        const target = Math.atan2(hx, hz);
        robotPose.heading += angleDelta(robotPose.heading, target) * (1 - Math.exp(-dt * TURN_RATE));
      }
      while (mark <= 3 && e >= mark * 0.25) { ev('robot.moving', { target: dest, progress: mark * 0.25 }); mark++; }
    });
    setPosition(WAYPOINTS[dest]);
    node = dest;
    set({ route: null, robot: { status: `Arrived · ${dest.replace(/_/g, ' ')}`, moving: false },
      camera: { mode: 'focus', target: WAYPOINTS[dest] } });
    ev('robot.arrived', { target: dest });
  }

  async function moveTo(dest: WaypointId, s?: WorkflowStage, label?: string) {
    if (dest === node) return;
    stage(s ?? travelStage(dest));
    await drive(dest, label ?? travelStatus(dest));
  }

  /** A short beat with the state change in the middle, so the world animation has time on both sides. */
  async function beat(change: () => void) {
    await sleep(BEAT_MS * 0.45, t);
    change();
    await sleep(BEAT_MS * 0.55, t);
  }

  async function pickUp(step: PlanStep) {
    const loc = get().item.location;
    if (loc === 'home' && node !== 'laundry_pickup') await moveTo('laundry_pickup');
    if (loc === 'shop' && node !== 'dry_cleaner') await moveTo('dry_cleaner');
    const shop = atShop();
    stage(shop ? 'SERVICE_PENDING' : 'PICKING_UP');
    status(pkg ? 'Loading package' : shop ? 'Loading clean laundry' : 'Loading laundry bag');
    const target = step.target ?? (pkg ? 'package' : 'laundry_bag');
    ev('robot.pickup_started', { target });
    await beat(() => set((s) => ({ item: { location: 'robot', clean: s.item.clean || shop } })));
    pickedUp = true;
    ev('robot.pickup_completed', { target });
  }

  async function dropOff(step: PlanStep) {
    const dest = resolveWaypoint(step.target) ?? node;
    if (dest !== node) await moveTo(dest);
    const shop = atShop();
    if (shop) { stage('DROPPING_OFF'); set({ shopActive: true }); } else advance('delivered');
    status(shop ? `Dropping off at ${shopName}` : 'Dropping off at the porch');
    await beat(() => {
      if (carrying()) set((s) => ({ item: { ...s.item, location: shop ? 'shop' : 'home' } }));
    });
    ev('robot.dropoff_completed', { target: dest });
  }

  async function wait(step: PlanStep) {
    stage('SERVICE_PENDING');
    set({ shopActive: true });
    status(pkg ? 'Store processing' : 'Cleaning in progress');
    await sleep(clamp(step.durationMs ?? 4000, 500, 8000), t);
    if (get().item.location === 'shop') {
      set((s) => ({ item: { ...s.item, clean: true } }));
      ev('service.completed', { target: node, detail: step.message });
      addActivity({
        source: 'system', verified: false, status: 'done',
        text: pkg ? 'Store processed the package' : 'Cleaner marked the order ready',
      });
    }
  }

  for (let i = 0; i < plan.steps.length; i++) {
    check(t);
    const step = plan.steps[i];
    set({ activeStepIndex: i });
    switch (step.action) {
      case 'MOVE_TO': {
        const dest = resolveWaypoint(step.target);
        if (dest) await moveTo(dest);
        else addActivity({ source: 'robot', verified: false, status: 'error', text: `Skipped step ${i + 1}: unknown target "${step.target}"` });
        break;
      }
      case 'PICK_UP': await pickUp(step); break;
      case 'DROP_OFF': await dropOff(step); break;
      case 'WAIT': await wait(step); break;
      case 'RETURN_HOME':
        stage('RETURNING');
        ev('robot.returning', { target: 'home' });
        await moveTo('home', 'RETURNING', 'Returning home');
        break;
      case 'REPORT_STATUS':
        addActivity({ source: 'robot', verified: false, status: 'done', text: step.message || 'Status update' });
        break;
    }
    await sleep(STEP_GAP_MS, t);
  }

  if (node !== 'home') await moveTo('home', 'RETURNING', 'Parking in the driveway');
  const h0 = robotPose.heading;
  const dh = angleDelta(h0, Math.PI);
  await animate(900, t, (p) => { robotPose.heading = h0 + dh * easeInOut(p); });
  robotPose.heading = Math.PI;
  set({ route: null, shopActive: false, robot: { status: 'Parked', moving: false } });
}
