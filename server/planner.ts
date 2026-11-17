// Claude planner: natural-language request -> validated RobotPlan + scene variant (POST /api/plan).
import Anthropic from '@anthropic-ai/sdk';
import type { PlanResponse } from '../shared/api';
import type { RobotPlan, SceneSpec } from '../shared/types';
import { ACTIONS } from '../shared/types';
import { DEFAULT_SCENE, DEMO_PLAN, ITEM_TARGETS, PACKAGE_SCENE, ROBOT_ID, TARGET_ALIASES } from '../shared/world';
import { validatePlan, validateScene } from '../shared/validate';

const MODEL = 'claude-opus-5-5';
const FALLBACK_SUMMARY = "I'll handle this errand with your delivery robot.";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 }));

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['taskKind', 'summary', 'objective', 'shopLabel', 'steps'],
  properties: {
    taskKind: { type: 'string', enum: ['dry_cleaning', 'package_return', 'other'] },
    summary: { type: 'string', description: 'One friendly chat sentence, at most 20 words.' },
    objective: { type: 'string', description: 'Short objective for the robot plan.' },
    shopLabel: { type: 'string', description: 'Storefront sign text, uppercase, at most 16 characters.' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'target', 'durationMs', 'message'],
        properties: {
          action: { type: 'string', enum: [...ACTIONS] },
          target: { type: ['string', 'null'] },
          durationMs: { type: ['integer', 'null'] },
          message: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

interface ClaudePlan {
  taskKind: 'dry_cleaning' | 'package_return' | 'other';
  summary: string;
  objective: string;
  shopLabel: string;
  steps: { action: string; target: string | null; durationMs: number | null; message: string | null }[];
}

const SYSTEM_PROMPT = `You are the mission planner for FoWorld, a small simulated suburban neighborhood with one wheeled delivery robot (robotId "${ROBOT_ID}", a cargo buggy that carries one item at a time). A user asks for an errand; an AI concierge is coordinating the business separately. Your job is to turn the errand into a short, executable robot plan that a simulator will animate.

World: the user's home (robot parks on the driveway), a porch pickup spot, a road with an intersection, and one shop across the street (dry cleaner, shipping store, etc. - the same building with a different sign).

Actions (use exactly these):
- MOVE_TO {target: waypoint} - drive to a waypoint.
- PICK_UP {target: item id} - load an item. Only when not already carrying something.
- DROP_OFF {target: waypoint} - unload the carried item at a waypoint. Only while carrying.
- WAIT {durationMs} - wait at the current location; 3000-5000 ms represents compressed service time (a time-lapse of hours or days). Add a short message such as "Cleaning in progress".
- RETURN_HOME {} - drive back to the parking spot. No target.
- REPORT_STATUS {message} - post a short status line (max 200 chars).

Valid waypoint targets: ${Object.keys(TARGET_ALIASES).join(', ')}.
Use "laundry_pickup" (porch) to collect items from home, "dry_cleaner"/"dropoff_zone" for the shop counter, "home_delivery_zone" to deliver items back at home.
Valid item ids for PICK_UP: ${ITEM_TARGETS.join(', ')} (laundry_bag = dirty clothes, clean_laundry = finished clothes, package = parcel, item = anything else).

Rules:
- Always PICK_UP before DROP_OFF; never pick up while carrying.
- If the errand brings something back (e.g. cleaned clothes), WAIT at the shop, PICK_UP the finished item, RETURN_HOME, then DROP_OFF at home_delivery_zone.
- End with RETURN_HOME (followed only by the final home DROP_OFF when bringing items back).
- 4-12 steps. Set unused fields to null (target null for WAIT/RETURN_HOME/REPORT_STATUS, durationMs null except WAIT, message null unless useful).
- taskKind: "dry_cleaning" for laundry/clothes errands, "package_return" for parcels/returns/shipping, otherwise "other" (map it onto the same shop and the generic "item").
- shopLabel: the storefront sign for the shop, uppercase, max 16 chars (e.g. "DRY CLEANERS", "SHIP & POST").
- summary: one friendly sentence (max 20 words) for the chat, e.g. "Coordinating the cleaner and preparing your delivery robot."

Reference plan for "Get my clothes dry-cleaned":
${JSON.stringify(DEMO_PLAN.steps)}`;

function buildScene(taskKind: ClaudePlan['taskKind'], shopLabel: string): SceneSpec | null {
  const base = taskKind === 'package_return' ? PACKAGE_SCENE : DEFAULT_SCENE;
  const label = shopLabel.trim().toUpperCase().slice(0, 16) || base.shopLabel;
  return validateScene({
    ...base,
    shopLabel: label,
    objects: base.objects.map((o) => (o.id === 'shop' ? { ...o, label } : o)),
  });
}

const fallback = (errors: string[]): PlanResponse => ({
  plan: { ...DEMO_PLAN, taskId: `task-${Date.now()}` },
  source: 'fallback',
  summary: FALLBACK_SUMMARY,
  scene: DEFAULT_SCENE,
  errors,
});

export async function planRequest(request: string): Promise<PlanResponse> {
  const t0 = Date.now();
  try {
    const res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages: [{ role: 'user', content: request }],
    });
    console.log(`[planner] claude ${Date.now() - t0}ms stop=${res.stop_reason} model=${res.model} out=${res.usage.output_tokens}`);
    if (res.stop_reason === 'refusal') return fallback(['Claude declined to plan this request']);
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let parsed: ClaudePlan;
    try {
      parsed = JSON.parse(text);
    } catch {
      return fallback([`Claude returned unparseable output (stop_reason=${res.stop_reason})`]);
    }

    const candidate: RobotPlan = {
      taskId: `task-${Date.now()}`,
      objective: parsed.objective,
      robotId: ROBOT_ID,
      steps: parsed.steps.map((s) => ({
        action: s.action as RobotPlan['steps'][number]['action'],
        ...(s.target != null && { target: s.target }),
        ...(s.durationMs != null && { durationMs: s.durationMs }),
        ...(s.message != null && { message: s.message }),
      })),
    };
    const v = validatePlan(candidate);
    if (!v.ok) {
      console.warn(`[planner] invalid plan: ${v.errors.join('; ')}`);
      return fallback(v.errors);
    }
    const scene = buildScene(parsed.taskKind, parsed.shopLabel) ?? DEFAULT_SCENE;
    return { plan: v.plan, source: 'claude', summary: parsed.summary.trim() || FALLBACK_SUMMARY, scene };
  } catch (err) {
    const msg = err instanceof Anthropic.APIError ? `Claude API error ${err.status ?? ''}: ${err.message}` : `Planner error: ${(err as Error).message}`;
    console.error(`[planner] failed after ${Date.now() - t0}ms: ${msg}`);
    return fallback([msg]);
  }
}
