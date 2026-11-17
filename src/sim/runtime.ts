// Shared simulator plumbing: run-token cancellation, rAF-driven timing, and small store-writing helpers.
import type { Vec3, WorldEvent } from '../../shared/types';
import { WAYPOINTS } from '../../shared/world';
import { robotPose, uid, useFoStore, type ActivityEntry, type ChecklistItem } from '../store';

// ---- Cancellation ----
export class Aborted extends Error {
  constructor() { super('aborted'); }
}
let token = 0;
/** Starts a new run (implicitly cancelling any previous one) and returns its token. */
export const newRun = () => ++token;
export const cancelRuns = () => { token++; };
export const isCurrent = (t: number) => t === token;
export function check(t: number) { if (t !== token) throw new Aborted(); }

// ---- Timing (all time flows through performance.now + requestAnimationFrame) ----
/** Calls fn(progress 0..1, dtMs) every frame for durationMs. Rejects with Aborted if the run is cancelled. */
export function animate(durationMs: number, t: number, fn: (p: number, dt: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let last = start;
    const tick = () => {
      if (!isCurrent(t)) return reject(new Aborted());
      const now = performance.now();
      const p = durationMs <= 0 ? 1 : Math.min(1, (now - start) / durationMs);
      try { fn(p, now - last); } catch (e) { return reject(e); }
      last = now;
      if (p >= 1) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
export const sleep = (ms: number, t: number) => animate(ms, t, () => {});

// ---- Math ----
export const easeInOut = (p: number) => 0.5 - 0.5 * Math.cos(Math.PI * p);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Signed shortest angular difference b - a, in (-PI, PI]. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// ---- Pose ----
export function setPosition(p: Vec3) {
  const pos = robotPose.position;
  pos[0] = p[0]; pos[1] = p[1]; pos[2] = p[2];
}
export function resetPose() {
  setPosition(WAYPOINTS.home);
  robotPose.heading = Math.PI;
}

// ---- Store helpers ----
export const get = useFoStore.getState;
export const set = useFoStore.setState;

export function emit(e: Omit<WorldEvent, 'ts'>) {
  set((s) => ({ events: [...s.events, { ts: Date.now(), ...e }] }));
}

export function addActivity(a: Omit<ActivityEntry, 'id' | 'ts'>): string {
  const id = uid('act');
  set((s) => ({ activity: [...s.activity, { id, ts: Date.now(), ...a }] }));
  return id;
}

export function updateActivity(id: string, patch: Partial<ActivityEntry>) {
  set((s) => ({ activity: s.activity.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
}

export function say(text: string, role: 'user' | 'assistant' = 'assistant') {
  set((s) => ({ messages: [...s.messages, { id: uid('msg'), role, text, ts: Date.now() }] }));
}

export function setChecklist(id: string, status: ChecklistItem['status'], label?: string) {
  set((s) => ({
    checklist: s.checklist.map((c) => (c.id === id ? { ...c, status, ...(label ? { label } : {}) } : c)),
  }));
}

/** Marks checklist item `id` active and every earlier robot item done. Never moves backwards.
 *  'fo' is owned by the orchestrator (Fo may still be replying while the robot drives). */
export function advance(id: string) {
  const list = get().checklist;
  const i = list.findIndex((c) => c.id === id);
  if (i < 0 || list[i].status === 'done') return;
  if (list.some((c, j) => j > i && c.id !== 'fo' && c.status !== 'pending')) return;
  set({
    checklist: list.map((c, j) =>
      j === i ? { ...c, status: 'active' } : j < i && c.id !== 'fo' && c.status !== 'error' ? { ...c, status: 'done' } : c),
  });
}
