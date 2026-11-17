// Plan + scene validation (PRD §9.3). Pure functions, shared by server and client.
import { ACTIONS, type ActionName, type PlanStep, type RobotPlan, type SceneObject, type SceneObjectType, type SceneSpec, type Vec3 } from './types';
import { HOME_ANCHOR, ITEM_TARGETS, ROAD_WIDTH, ROAD_Z, ROBOT_ID, SHOP_ANCHOR, resolveWaypoint } from './world';

const MAX_STEPS = 24;
const WAIT_MIN = 500;
const WAIT_MAX = 8000;
const WAIT_DEFAULT = 3000;
const MAX_MESSAGE = 200;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function validatePlan(input: unknown): { ok: true; plan: RobotPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ['plan must be an object'] };
  const rawSteps = input.steps;
  if (!Array.isArray(rawSteps)) return { ok: false, errors: ['plan.steps must be an array'] };
  if (rawSteps.length < 1 || rawSteps.length > MAX_STEPS) errors.push(`plan must have 1-${MAX_STEPS} steps (got ${rawSteps.length})`);

  const steps: PlanStep[] = [];
  let carrying = false;
  rawSteps.slice(0, MAX_STEPS).forEach((raw, i) => {
    const at = `step ${i + 1}`;
    if (!isObj(raw)) { errors.push(`${at}: must be an object`); return; }
    const action = typeof raw.action === 'string' ? raw.action.trim().toUpperCase() : '';
    if (!(ACTIONS as readonly string[]).includes(action)) { errors.push(`${at}: unknown action "${String(raw.action)}"`); return; }
    const a = action as ActionName;
    const target = str(raw.target);
    const message = str(raw.message);
    const step: PlanStep = { action: a };

    switch (a) {
      case 'MOVE_TO':
        if (!resolveWaypoint(target)) errors.push(`${at}: MOVE_TO target "${target ?? ''}" is not a known waypoint`);
        else step.target = target!.toLowerCase();
        break;
      case 'DROP_OFF':
        if (!resolveWaypoint(target)) errors.push(`${at}: DROP_OFF target "${target ?? ''}" is not a known waypoint`);
        else step.target = target!.toLowerCase();
        if (!carrying) errors.push(`${at}: DROP_OFF while not carrying anything`);
        carrying = false;
        break;
      case 'PICK_UP':
        if (!target || !(ITEM_TARGETS as readonly string[]).includes(target.toLowerCase())) errors.push(`${at}: PICK_UP target "${target ?? ''}" is not a known item`);
        else step.target = target.toLowerCase();
        if (carrying) errors.push(`${at}: PICK_UP while already carrying`);
        carrying = true;
        break;
      case 'WAIT': {
        const d = typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) ? raw.durationMs : WAIT_DEFAULT;
        step.durationMs = Math.round(Math.min(WAIT_MAX, Math.max(WAIT_MIN, d)));
        break;
      }
      case 'RETURN_HOME':
        if (target && resolveWaypoint(target) !== 'home') errors.push(`${at}: RETURN_HOME takes no target`);
        break;
      case 'REPORT_STATUS':
        if (!message) errors.push(`${at}: REPORT_STATUS needs a message`);
        break;
    }
    if (message) {
      if (a === 'REPORT_STATUS' && message.length > MAX_MESSAGE) errors.push(`${at}: REPORT_STATUS message exceeds ${MAX_MESSAGE} chars`);
      else step.message = message.slice(0, MAX_MESSAGE);
    }
    steps.push(step);
  });

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    plan: {
      taskId: str(input.taskId) ?? `task-${Date.now()}`,
      objective: (str(input.objective) ?? 'Robot errand').slice(0, MAX_MESSAGE),
      robotId: str(input.robotId) ?? ROBOT_ID,
      steps,
    },
  };
}

const OBJECT_TYPES: readonly SceneObjectType[] = ['house', 'store', 'tree', 'lamp', 'car', 'bush', 'bench', 'mailbox'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const BOUNDS_X = 22;
const BOUNDS_Z = 12;
// Interpretation note: the road band is the asphalt itself (half of ROAD_WIDTH either side of ROAD_Z) and building
// clearance is 3 units; the literal "|z-ROAD_Z| < ROAD_WIDTH" / 4-unit rules would strip DEFAULT_SCENE's own lamps,
// bench, mailbox and porch bushes.
const ROAD_HALF = ROAD_WIDTH / 2;
const ANCHOR_CLEARANCE = 3;

const cleanLabel = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s.toUpperCase().slice(0, 16) : undefined;
};

const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Returns a sanitized scene, or null if the scene is unusable. Invalid decor objects are dropped. */
export function validateScene(input: unknown): SceneSpec | null {
  if (!isObj(input) || !Array.isArray(input.objects)) return null;
  const itemKind = input.itemKind === 'package' ? 'package' : input.itemKind === 'laundry_bag' ? 'laundry_bag' : null;
  const shopLabel = cleanLabel(input.shopLabel);
  if (!itemKind || !shopLabel) return null;

  const objects: SceneObject[] = [];
  const seen = new Set<string>();
  for (const raw of input.objects) {
    if (!isObj(raw)) continue;
    const id = str(raw.id);
    const type = raw.type as SceneObjectType;
    if (!id || seen.has(id) || !OBJECT_TYPES.includes(type) || !isVec3(raw.position)) continue;

    let position: Vec3 = [raw.position[0], 0, raw.position[2]];
    if (id === 'home') position = [...HOME_ANCHOR];
    else if (id === 'shop') position = [...SHOP_ANCHOR];
    else {
      const [x, , z] = position;
      if (Math.abs(x) > BOUNDS_X || Math.abs(z) > BOUNDS_Z) continue;
      if (Math.abs(z - ROAD_Z) < ROAD_HALF) continue;
      if ([HOME_ANCHOR, SHOP_ANCHOR].some((a) => Math.hypot(x - a[0], z - a[2]) < ANCHOR_CLEARANCE)) continue;
    }

    const obj: SceneObject = { id, type, position };
    if (typeof raw.rotation === 'number' && Number.isFinite(raw.rotation)) obj.rotation = raw.rotation;
    const label = cleanLabel(raw.label);
    if (label) obj.label = label;
    if (typeof raw.color === 'string' && HEX.test(raw.color)) obj.color = raw.color;
    if (typeof raw.scale === 'number' && raw.scale >= 0.5 && raw.scale <= 2) obj.scale = raw.scale;
    seen.add(id);
    objects.push(obj);
  }
  if (!seen.has('home') || !seen.has('shop')) return null;

  const scene: SceneSpec = { environment: 'suburban_neighborhood', camera: 'isometric', shopLabel, itemKind, objects };
  if (typeof input.accent === 'string' && HEX.test(input.accent)) scene.accent = input.accent;
  return scene;
}
