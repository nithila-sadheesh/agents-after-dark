// Client-side workflow orchestrator. Signatures are a contract with the UI; keep them.
// Live mode: real Fo (via /api/fo/*) + Claude plan (via /api/plan), then the deterministic executor.
// Demo mode: zero network — staged, clearly-unverified Fo activity + DEMO_PLAN.
import type { RobotPlan, SceneSpec } from '../../shared/types';
import { DEFAULT_SCENE, DEMO_PLAN, WAYPOINTS } from '../../shared/world';
import { initialState, uid, type ApprovalRequest, type ChecklistItem, type FoWorldState } from '../store';
import * as api from './api';
import { BOOKING_CONFIRMED_RE, FO_LIVE_ACTIONS } from '../../shared/config';
import { previewRoute, runPlan } from './executor';
import {
  Aborted, addActivity, cancelRuns, check, emit, get, isCurrent, newRun, resetPose, say, set, setChecklist, sleep,
  updateActivity,
} from './runtime';

export const DEMO_REQUEST = 'Fo, get my clothes dry-cleaned and bring them back. Use my Rover S6 delivery buggy.';

const FO_PROCEED_MS = 25_000;      // stop blocking on Fo after this; keep polling in the background
const FO_POLL_MS = 2_500;
const FO_POLL_MAX_MS = 12 * 60_000; // real Fo research replies take ~8-9 min
const DEMO_QUOTE = '$18.50';
const QUOTE_RE = /\$\s?\d+(?:\.\d{2})?/;

type Kind = 'laundry' | 'package';
type Task = NonNullable<FoWorldState['task']>;

let running = false;
let session = 0; // bumped by startTask/reset; guards background Fo polling (survives replay)
let approvalResolver: ((ok: boolean) => void) | null = null;
let last: { plan: RobotPlan; planSource: FoWorldState['planSource']; scene: SceneSpec; task: Task; kind: Kind } | null = null;

const kindOf = (request: string): Kind => (/\b(package|parcel|return|ship|shipping|post office|ups|fedex|usps)\b/i.test(request) ? 'package' : 'laundry');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function checklistFor(kind: Kind): ChecklistItem[] {
  const labels: [string, string][] = kind === 'package'
    ? [['fo', 'Fo coordination'], ['plan', 'Robot plan'], ['pickup', 'Pick up package'], ['travel', 'Travel to store'],
      ['handoff', 'Hand off package'], ['return', 'Return home']]
    : [['fo', 'Fo coordination'], ['plan', 'Robot plan'], ['pickup', 'Pickup'], ['travel', 'Travel to shop'],
      ['handoff', 'Handoff'], ['service', 'Service'], ['return', 'Return'], ['delivered', 'Delivered']];
  return labels.map(([id, label]) => ({ id, label, status: 'pending' }));
}

function resetWorld(keepMessages: boolean) {
  const { fo, messages } = get();
  set({ ...initialState(), fo, messages: keepMessages ? messages : [] });
  resetPose();
}

function applyPlan(plan: RobotPlan, planSource: FoWorldState['planSource'], scene: SceneSpec) {
  set({ plan, planSource, scene, route: previewRoute(plan), camera: { mode: 'overview' } });
  setChecklist('plan', 'done');
  emit({ type: 'robot.plan_created', robotId: plan.robotId, detail: `${plan.steps.length} steps · ${planSource}` });
}

// ---------------- Live mode ----------------

async function loadPlan(request: string, t: number): Promise<RobotPlan> {
  try {
    const r = await api.fetchPlan(request);
    check(t);
    applyPlan(r.plan, r.source, r.scene ?? DEFAULT_SCENE);
    if (r.summary) say(r.summary);
    const n = r.plan.steps.length;
    addActivity(r.source === 'claude'
      ? { source: 'claude', verified: true, status: 'done', text: `Claude generated a ${n}-step robot plan` }
      : { source: 'claude', verified: false, status: 'error',
          text: `Claude plan unavailable — using the ${n}-step fallback plan${r.errors?.length ? ` (${r.errors.join('; ')})` : ''}` });
    return r.plan;
  } catch (e) {
    if (e instanceof Aborted) throw e;
    check(t);
    applyPlan(DEMO_PLAN, 'fallback', DEFAULT_SCENE);
    addActivity({ source: 'claude', verified: false, status: 'error',
      text: `Planner unreachable — using the ${DEMO_PLAN.steps.length}-step fallback plan` });
    return DEMO_PLAN;
  }
}

interface FoTrack { reply: string | null; settled: boolean; stillWorkingId: string | null }

/** Sends the raw request to Fo and tracks the reply. Resolves when Fo replied or failed (may be after FO_PROCEED_MS). */
async function runFo(request: string, s: number, fo: FoTrack): Promise<void> {
  const live = () => s === session;
  set({ stage: 'COORDINATING' });
  setChecklist('fo', 'active');
  emit({ type: 'agent.coordination_started', detail: 'ask_fo' });
  const sentId = addActivity({ source: 'fo', verified: true, status: 'pending', text: 'Request sent to Fo' });

  const deliver = (reply: string) => {
    fo.reply = reply;
    fo.settled = true;
    updateActivity(sentId, { status: 'done' });
    if (fo.stillWorkingId) updateActivity(fo.stillWorkingId, { status: 'done' });
    addActivity({ source: 'fo', verified: true, status: 'done', text: reply });
    say(`Fo: ${reply}`);
    emit({ type: 'agent.reply', detail: reply });
    setChecklist('fo', 'done');
  };
  const fail = (why?: string, unauthenticated = false) => {
    fo.settled = true;
    updateActivity(sentId, { status: 'error' });
    if (fo.stillWorkingId) updateActivity(fo.stillWorkingId, { status: 'error' });
    if (unauthenticated) set((st) => ({ fo: { ...st.fo, authenticated: false } }));
    addActivity({ source: 'system', verified: false, status: 'error',
      text: `Fo unavailable — continuing with the robot plan${why ? ` (${why})` : ''}` });
    setChecklist('fo', 'done', 'Fo coordination');
  };

  try {
    let r = await api.foAsk(request);
    if (!live()) return;
    if (r.conversationId) set((st) => ({ fo: { ...st.fo, conversationId: r.conversationId } }));
    const deadline = Date.now() + FO_POLL_MAX_MS;
    let misses = 0;
    let lastProgress = '';
    const showProgress = () => {
      // Fo's own progress notes are genuine Fo output -> verified (LIVE).
      if (r.progress && r.progress !== lastProgress) {
        lastProgress = r.progress;
        updateActivity(sentId, { text: `Fo is working: ${r.progress}` });
      }
    };
    showProgress();
    while (r.status === 'pending' && r.conversationId && Date.now() < deadline) {
      await wait(FO_POLL_MS);
      if (!live()) return;
      try { r = await api.foReply(r.conversationId); misses = 0; } catch { if (++misses >= 4) break; }
      if (!live()) return;
      showProgress();
    }
    if (r.status === 'complete' && r.reply) return deliver(r.reply);
    if (r.status === 'pending') return fail('no reply yet after 12 minutes');
    fail(r.error ?? (r.status === 'unauthenticated' ? 'run npm run fo:login' : r.status), r.status === 'unauthenticated');
  } catch {
    if (live()) fail('server unreachable');
  }
}

async function prepareLive(request: string, t: number, s: number) {
  const fo: FoTrack = { reply: null, settled: false, stillWorkingId: null };
  const foDone = runFo(request, s, fo);
  const [plan] = await Promise.all([loadPlan(request, t), FO_LIVE_ACTIONS ? foDone : Promise.race([foDone, sleep(FO_PROCEED_MS, t)])]);
  check(t);
  if (!fo.settled) {
    fo.stillWorkingId = addActivity({ source: 'system', verified: false, status: 'pending',
      text: 'Fo is still working — continuing; replies will appear here' });
  }
  return { plan, foReply: fo.reply, planSource: get().planSource };
}

// ---------------- Demo / presentation mode (no network) ----------------

async function prepareDemo(t: number) {
  const fo = (text: string, status: 'pending' | 'done' = 'done') => addActivity({ source: 'fo', verified: false, status, text });
  const claude = (text: string, status: 'pending' | 'done' = 'done') => addActivity({ source: 'claude', verified: false, status, text });
  const step = async (id: string, ms: number, done?: string) => { await sleep(ms, t); updateActivity(id, done ? { status: 'done', text: done } : { status: 'done' }); };

  await sleep(400, t);
  set({ stage: 'COORDINATING' });
  setChecklist('fo', 'active');
  emit({ type: 'agent.coordination_started', detail: 'ask_fo' });
  // Robot: identify the model and get a control protocol for it.
  let r = fo('Identifying your robot · Rover S6 six-wheel delivery buggy…', 'pending');
  let id = fo('Searching for dry cleaners near you…', 'pending');
  await step(r, 500, 'Robot found · Rover S6 (buggy-01) · battery 92% · parked at home');
  r = fo('Looking up Rover S6 robotics protocol…', 'pending');
  await step(id, 300, 'Found Sparkle & Press Dry Cleaners · 0.4 mi · 4.8★ · open until 7 PM');
  await step(r, 400, 'Rover S6 SDK found · ROS 2 Nav2 actions + lid control API');
  const scene = claude('Generating 3D scene for this errand…', 'pending');
  id = fo('Calling Sparkle & Press (415) 555-0142…', 'pending');
  await step(scene, 500, 'Scene ready · your townhouse → Sparkle & Press, 4 blocks, 2 crossings');
  const plan = claude('Planning robot route and actions…', 'pending');
  await step(id, 600, 'Call connected · confirmed they accept robot drop-offs');
  await step(plan, 200);
  applyPlan(DEMO_PLAN, 'demo', DEFAULT_SCENE);
  updateActivity(plan, { text: `Robot plan ready · ${DEMO_PLAN.steps.length} steps, validated` });
  r = fo('Writing Rover S6 command protocol from the plan…', 'pending');
  id = fo('Scheduling drop-off…', 'pending');
  await step(r, 500, 'Protocol compiled · nav_to_pose ×4, lid_open/close, cargo_load/unload');
  await step(id, 400, 'Booked · drop-off today 4:30 PM, ready tomorrow 9 AM');
  say('Plan ready: your Rover S6 will pick up the laundry bag, drive it to Sparkle & Press, wait for cleaning, and bring it home.');
  fo(`Quote: ${DEMO_QUOTE} for 3 garments`);
  setChecklist('fo', 'done', 'Fo coordination');
  await sleep(300, t);
  return { plan: DEMO_PLAN, foReply: null as string | null, planSource: 'demo' as const };
}

// ---------------- Approval ----------------

function requestApproval(kind: Kind, foReply: string | null): { approval: ApprovalRequest; decision: Promise<boolean> } {
  const quote = foReply?.match(QUOTE_RE)?.[0];
  const title = kind === 'package' ? 'Approve shipping charge?' : 'Approve dry-cleaning charge?';
  const approval: ApprovalRequest = quote
    ? { title, amount: quote.replace(/\s/g, ''), detail: 'Quote from Fo', source: 'fo_quote' }
    : { title, amount: DEMO_QUOTE, detail: 'Estimated quote', source: 'demo' };
  set({ stage: 'NEEDS_APPROVAL', approval, robot: { status: 'Awaiting your approval', moving: false } });
  emit({ type: 'agent.approval_required', detail: `${approval.amount} · ${approval.source}` });
  const decision = new Promise<boolean>((resolve) => { approvalResolver = resolve; });
  return { approval, decision };
}

function settleApproval(ok: boolean) {
  const r = approvalResolver;
  approvalResolver = null;
  r?.(ok);
}

// ---------------- Execution ----------------

async function execute(plan: RobotPlan, t: number) {
  await runPlan(plan, { token: t });
  check(t);
  const { scene } = get();
  const isPackage = scene.itemKind === 'package';
  set((s) => ({
    stage: 'COMPLETED',
    // Leave Fo 'active' if it is genuinely still working — never imply it finished.
    checklist: s.checklist.map((c) => (c.id === 'fo' && c.status === 'active' ? c : { ...c, status: 'done' })),
    toast: isPackage ? 'Your package has been dropped off.' : 'Your dry cleaning is home.',
    camera: { mode: 'overview' },
    highlights: [],
    route: null,
    activeStepIndex: -1,
    robot: { status: 'Parked — task complete', moving: false },
  }));
  emit({ type: 'task.completed', robotId: plan.robotId });
  say(isPackage
    ? 'Done — the robot handed off your package and is back in the driveway.'
    : 'Done — your clothes are back on the porch, cleaned.');
}

function failTask(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  set({ stage: 'FAILED', approval: null, robot: { status: 'Stopped — error', moving: false } });
  emit({ type: 'task.failed', detail: msg });
  say(`Something went wrong while running the task: ${msg}`);
}

// ---------------- Public API ----------------

export async function startTask(request: string, opts: { mode: 'live' | 'demo' }): Promise<void> {
  const text = request.trim();
  if (running || !text) return;
  // The dry-cleaning suggestion always runs the scripted, network-free demo flow.
  if (text === DEMO_REQUEST || /dry[- ]clean/i.test(text) && text.toLowerCase().includes('bring them back')) opts = { mode: 'demo' };
  running = true;
  const t = newRun();
  const s = ++session;
  const kind = kindOf(text);
  const task: Task = { id: uid('task'), title: kind === 'package' ? 'Package Return' : 'Dry Cleaning', request: text, mode: opts.mode };

  resetWorld(true);
  set({
    task, stage: 'PLANNING',
    checklist: checklistFor(kind).map((c) => (c.id === 'plan' ? { ...c, status: 'active' } : c)),
    camera: { mode: 'focus', target: WAYPOINTS.laundry_pickup },
    highlights: ['robot', 'item'],
    robot: { status: 'Waiting for plan', moving: false },
  });
  say(text, 'user');
  say(kind === 'package'
      ? 'On it — asking Fo to coordinate the store while I plan the robot trip.'
      : 'On it — asking Fo to coordinate a dry cleaner while I plan the robot trip.');
  emit({ type: 'task.started', detail: text });

  try {
    const { plan, foReply, planSource } = opts.mode === 'demo' ? await prepareDemo(t) : await prepareLive(text, t, s);
    check(t);

    const { approval, decision } = requestApproval(kind, foReply);
    const ok = await decision;
    check(t);
    if (!ok) {
      set({ stage: 'IDLE', task: null, approval: null, checklist: [], plan: null, planSource: null, route: null,
        highlights: [], camera: { mode: 'overview' }, robot: { status: 'Idle — ready', moving: false } });
      say('Okay, cancelled.');
      return;
    }
    set({ approval: null, stage: 'READY', robot: { status: 'Dispatching robot', moving: false } });
    if (opts.mode === 'demo') {
      // Runs alongside the robot drive (adds no time to the demo).
      const pay = addActivity({ source: 'fo', verified: false, status: 'pending', text: `Paying Sparkle & Press ${approval.amount}…` });
      void (async () => {
        await sleep(900, t);
        updateActivity(pay, { status: 'done', text: `Paid ${approval.amount} · receipt #SP-20417` });
        const mail = addActivity({ source: 'fo', verified: false, status: 'pending', text: 'Emailing Sparkle & Press the order details…' });
        await sleep(1500, t);
        updateActivity(mail, { status: 'done', text: 'Emailed order: 3 garments, robot drop-off 4:30 PM, Rover S6 arriving' });
        await sleep(1200, t);
        addActivity({ source: 'fo', verified: false, status: 'done', text: 'Sent you the receipt and pickup details by email' });
        addActivity({ source: 'fo', verified: false, status: 'done', text: 'Dispatched Rover S6 · protocol uploaded · en route' });
      })().catch(() => {});
    } else {
      addActivity(approval.source === 'fo_quote'
        ? { source: 'system', verified: false, status: 'done', text: `Approved ${approval.amount} locally — nothing sent to Fo, no charge made` }
        : { source: 'system', verified: false, status: 'done', text: 'Payment authorized' });
    }
    if (FO_LIVE_ACTIONS && opts.mode === 'live') await confirmBookingWithFo(approval.amount, t);
    last = { plan, planSource, scene: get().scene, task, kind };
    await sleep(1000, t);
    await execute(plan, t);
  } catch (e) {
    if (!(e instanceof Aborted) && isCurrent(t)) failTask(e);
  } finally {
    if (isCurrent(t)) running = false;
  }
}

export function approve(): void {
  settleApproval(true);
}

export function decline(): void {
  settleApproval(false);
}

export function replay(): void {
  if (running || !last) return;
  const { plan, planSource, scene, task, kind } = last;
  running = true;
  const t = newRun();
  resetPose();
  set({
    task, plan, planSource, scene, stage: 'READY',
    checklist: checklistFor(kind).map((c) => (c.id === 'fo' || c.id === 'plan' ? { ...c, status: 'done' } : c)),
    item: { location: 'home', clean: false },
    route: null, shopActive: false, toast: null, approval: null, activeStepIndex: -1,
    highlights: ['robot', 'item'],
    camera: { mode: 'focus', target: WAYPOINTS.laundry_pickup },
    robot: { status: 'Replaying last plan', moving: false },
  });
  addActivity({ source: 'system', verified: false, status: 'done',
    text: 'Replaying the last run' });
  void (async () => {
    try {
      await sleep(600, t);
      await execute(plan, t);
    } catch (e) {
      if (!(e instanceof Aborted) && isCurrent(t)) failTask(e);
    } finally {
      if (isCurrent(t)) running = false;
    }
  })();
}

export function reset(): void {
  cancelRuns();
  session++;
  running = false;
  settleApproval(false); // unblocks a pending approval; its run is already cancelled
  resetWorld(false);
}

export async function checkFoStatus(): Promise<void> {
  try {
    const r = await api.foStatus();
    set((s) => ({ fo: { ...s.fo, connected: !!r.connected, authenticated: !!r.authenticated } }));
  } catch {
    set((s) => ({ fo: { ...s.fo, connected: false, authenticated: false } }));
  }
}

/** FO_LIVE_ACTIONS only: send the human's approval to Fo and wait until Fo confirms the booking before dispatch. */
async function confirmBookingWithFo(amount: string, t: number): Promise<void> {
  const conversationId = get().fo.conversationId;
  if (!conversationId) throw new Error('No Fo conversation to approve');
  set({ robot: { status: 'Waiting for Fo to confirm the booking', moving: false } });
  const id = addActivity({ source: 'fo', verified: true, status: 'pending', text: `Approval sent to Fo · paying ${amount}` });
  let r = await api.foApprove(conversationId, amount);
  const deadline = Date.now() + FO_POLL_MAX_MS;
  while (!(r.status === 'complete' && r.reply && BOOKING_CONFIRMED_RE.test(r.reply))) {
    if (r.status === 'error' || r.status === 'unauthenticated' || Date.now() > deadline) {
      updateActivity(id, { status: 'error' });
      throw new Error(r.error ?? 'Fo did not confirm the booking');
    }
    if (r.progress) updateActivity(id, { text: `Fo is working: ${r.progress}` });
    await sleep(FO_POLL_MS, t);
    r = await api.foReply(conversationId);
  }
  updateActivity(id, { status: 'done' });
  addActivity({ source: 'fo', verified: true, status: 'done', text: r.reply! });
  say(`Fo: ${r.reply}`);
  emit({ type: 'agent.booking_confirmed', detail: r.reply! });
}
