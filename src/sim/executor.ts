// Deterministic robot execution simulator: runs a validated RobotPlan step by step, animating robotPose
// and writing semantic events + workflow state to the store. No randomness, no network.
import type { PlanStep, RobotPlan, Vec3, WorkflowStage, WorldEventType } from '../../shared/types';
import { ROBOT_ID, WAYPOINTS, findRoute, resolveWaypoint, routePoints, type WaypointId } from '../../shared/world';
import { robotPose } from '../store';
import { planRoute, poseAt } from './motion';
import {
  addActivity, advance, angleDelta, animate, check, clamp, easeInOut, emit, get, set, setPosition, sleep,
} from './runtime';

const BEAT_MS = 1000;       // pickup / drop-off beat
const STEP_GAP_MS = 300;    // breathing room between steps so each one reads on screen
const CROSS_WAIT_MS = 1000; // stopped at the curb, "looking both ways"
const ARRIVE_DIST = 10;     // m before the destination: "Arriving at …" + camera swings to the destination
const APPROACH_DIST = 9;    // m before a crosswalk stop: "Approaching the crosswalk"
const PIVOT_MS = 250;       // turn in place: PIVOT_MS + PIVOT_MS_PER_RAD·|angle|
const PIVOT_MS_PER_RAD = 160;

const SHOP_SIDE: WaypointId[] = ['dry_cleaner', 'shop_curb'];
const HOME_SIDE: WaypointId[] = ['home', 'laundry_pickup', 'driveway'];
const STAGE_CHECKLIST: Partial<Record<WorkflowStage, string>> = {
  PICKING_UP: 'pickup', TRAVELING: 'travel', DROPPING_OFF: 'handoff', SERVICE_PENDING: 'service', RETURNING: 'return',
};

export interface ExecContext { token: number }

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const pretty = (id: WaypointId) => id.replace(/_/g, ' ');
/** Route length between two waypoints (along the graph). */
const routeLength = (a: WaypointId, b: WaypointId) => {
  const pts = routePoints(findRoute(a, b));
  return pts.slice(1).reduce((d, p, i) => d + Math.hypot(p[0] - pts[i][0], p[2] - pts[i][2]), 0);
};

/** Smoothed polyline of every leg the plan will drive (same walk as runPlan), for the pre-approval route preview. */
export function previewRoute(plan: RobotPlan): Vec3[] {
  let node: WaypointId = 'home';
  const pts: Vec3[] = [];
  const go = (dest: WaypointId | null) => {
    if (!dest || dest === node) return;
    for (const p of planRoute(routePoints(findRoute(node, dest))).points) {
      const l = pts[pts.length - 1];
      if (!l || Math.hypot(p[0] - l[0], p[2] - l[2]) > 1e-3) pts.push(p);
    }
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
    if (routeLength(dest, 'dry_cleaner') < routeLength(node, 'dry_cleaner')) return 'TRAVELING';
    return !carrying() && !pickedUp && get().item.location === 'home' ? 'PICKING_UP' : 'RETURNING';
  }

  function travelStatus(dest: WaypointId): string {
    if (dest === 'home') return carrying() ? 'Heading home' : 'Parking in the front yard';
    if (dest === 'laundry_pickup') {
      if (carrying()) return 'Delivering to the porch';
      return pkg ? 'Heading to the package' : 'Heading to laundry';
    }
    if (SHOP_SIDE.includes(dest)) return `Heading to ${shopName}`;
    return `Heading to the ${pretty(dest)}`;
  }

  /** Where the camera looks when the robot is at (or arriving at) `dest`. */
  const focusFor = (dest: WaypointId): Vec3 =>
    SHOP_SIDE.includes(dest) ? WAYPOINTS.dry_cleaner : HOME_SIDE.includes(dest) ? WAYPOINTS.laundry_pickup : WAYPOINTS[dest];

  function arrivedStatus(dest: WaypointId): string {
    if (dest === 'dry_cleaner') return `Arrived at ${shopName}`;
    if (dest === 'shop_curb') return `Outside ${shopName}`;
    if (dest === 'laundry_pickup') return 'At the front steps';
    if (dest === 'home') return 'Back home';
    return `Reached the ${pretty(dest)}`;
  }

  /** Turn in place (skid-steer) to face `target`. Heading stays continuous (no ±π wrap). */
  async function turnTo(target: number) {
    const h0 = robotPose.heading;
    const dh = angleDelta(h0, target);
    if (Math.abs(dh) < 0.02) { robotPose.heading = h0 + dh; return; }
    await animate(PIVOT_MS + PIVOT_MS_PER_RAD * Math.abs(dh), t, (p) => { robotPose.heading = h0 + dh * easeInOut(p); });
    robotPose.heading = h0 + dh;
  }

  async function drive(dest: WaypointId, label: string) {
    if (dest === node) return;
    const ids = findRoute(node, dest);
    const route = planRoute(routePoints(ids));
    const yard = HOME_SIDE.includes(node) && HOME_SIDE.includes(dest); // short porch shuffle: keep the house framed
    const focus = focusFor(dest);
    const arriving = SHOP_SIDE.includes(dest) ? `Arriving at ${shopName}`
      : HOME_SIDE.includes(dest) ? 'Arriving home' : `Arriving at the ${pretty(dest)}`;

    set({ route: route.points, shopActive: false, robot: { status: label, moving: true },
      camera: yard ? { mode: 'focus', target: focus } : { mode: 'follow' } });
    ev('robot.moving', { target: dest, progress: 0, detail: ids.join(' → ') });

    let shown = label, moving = true, focused = yard, mark = 1, before = 0;
    const show = (text: string, mv = true) => {
      if (text === shown && mv === moving) return;
      shown = text; moving = mv;
      status(text, mv);
    };
    const pose = { x: 0, z: 0, h: 0 };
    for (const leg of route.legs) {
      const cue = (k: number, left: number, r: number) => {
        if (leg.crossings.some((c, i) => i < r && k >= c.stop && k <= c.clear)) return 'Crossing the street';
        if (!yard && left <= ARRIVE_DIST) return arriving;
        for (const c of leg.corners) {
          if (!c.curb && before + leg.s[c.from] > 4 && k >= c.from && k <= c.to) return `Turning ${c.dir} at the corner`;
        }
        for (const c of leg.crossings) if (k <= c.stop && leg.s[c.stop] - leg.s[k] < APPROACH_DIST) return 'Approaching the crosswalk';
        return label;
      };
      await turnTo(leg.h[0]);
      const runs = [0, ...leg.crossings.map((c) => c.stop), leg.n - 1];
      for (let r = 0; r + 1 < runs.length; r++) {
        if (r > 0) { show('Waiting to cross', false); await sleep(CROSS_WAIT_MS, t); }
        const [t0, t1] = [leg.t[runs[r]], leg.t[runs[r + 1]]];
        if (t1 <= t0) continue;
        await animate((t1 - t0) * 1000, t, (p) => {
          const k = poseAt(leg, t0 + p * (t1 - t0), pose);
          setPosition([pose.x, 0, pose.z]);
          robotPose.heading += angleDelta(robotPose.heading, pose.h);
          const done = before + leg.s[k];
          const left = route.length - done;
          if (!focused && left <= ARRIVE_DIST) { focused = true; set({ camera: { mode: 'focus', target: focus } }); }
          show(cue(k, left, r));
          while (mark <= 3 && done >= route.length * mark * 0.25) { ev('robot.moving', { target: dest, progress: mark * 0.25 }); mark++; }
        });
      }
      before += leg.length;
    }
    setPosition(WAYPOINTS[dest]);
    node = dest;
    set({ route: null, robot: { status: arrivedStatus(dest), moving: false }, camera: { mode: 'focus', target: focus } });
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
    if (shop) { stage('DROPPING_OFF'); set({ shopActive: true, camera: { mode: 'focus', target: WAYPOINTS.dry_cleaner } }); }
    else advance('delivered');
    status(shop ? `Dropping off at ${shopName}` : 'Dropping off at the porch');
    await beat(() => {
      if (carrying()) set((s) => ({ item: { ...s.item, location: shop ? 'shop' : 'home' } }));
    });
    ev('robot.dropoff_completed', { target: dest });
  }

  async function wait(step: PlanStep) {
    stage('SERVICE_PENDING');
    set({ shopActive: true, ...(atShop() ? { camera: { mode: 'focus' as const, target: WAYPOINTS.dry_cleaner } } : {}) });
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
        await moveTo('home', 'RETURNING', 'Heading home');
        break;
      case 'REPORT_STATUS':
        addActivity({ source: 'robot', verified: false, status: 'done', text: step.message || 'Status update' });
        break;
    }
    await sleep(STEP_GAP_MS, t);
  }

  if (node !== 'home') await moveTo('home', 'RETURNING', 'Parking in the front yard');
  await turnTo(Math.PI);
  set({ route: null, shopActive: false, robot: { status: 'Parked', moving: false } });
}
