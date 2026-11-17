import type { ItemKind, PlanStep, WorkflowStage } from '../../shared/types';
import type { ItemLocation } from '../store';

export const GLASS =
  'rounded-2xl border border-white/10 bg-slate-950/55 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl';

export const isRunning = (s: WorkflowStage) => s !== 'IDLE' && s !== 'COMPLETED' && s !== 'FAILED';

export type Tone = 'slate' | 'violet' | 'blue' | 'sky' | 'amber' | 'emerald' | 'rose';

export const STAGE_META: Record<WorkflowStage, { label: string; tone: Tone }> = {
  IDLE: { label: 'Idle', tone: 'slate' },
  PLANNING: { label: 'Planning', tone: 'violet' },
  COORDINATING: { label: 'Coordinating with Fo', tone: 'blue' },
  NEEDS_APPROVAL: { label: 'Needs approval', tone: 'amber' },
  READY: { label: 'Ready to roll', tone: 'sky' },
  PICKING_UP: { label: 'Picking up', tone: 'blue' },
  TRAVELING: { label: 'En route', tone: 'blue' },
  DROPPING_OFF: { label: 'Dropping off', tone: 'blue' },
  SERVICE_PENDING: { label: 'Service in progress', tone: 'violet' },
  RETURNING: { label: 'Returning home', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  FAILED: { label: 'Failed', tone: 'rose' },
};

export const TONE_PILL: Record<Tone, string> = {
  slate: 'bg-white/8 text-white/70 ring-white/15',
  violet: 'bg-violet-400/15 text-violet-200 ring-violet-300/30',
  blue: 'bg-indigo-400/15 text-indigo-200 ring-indigo-300/30',
  sky: 'bg-sky-400/15 text-sky-200 ring-sky-300/30',
  amber: 'bg-amber-400/15 text-amber-200 ring-amber-300/30',
  emerald: 'bg-emerald-400/15 text-emerald-200 ring-emerald-300/30',
  rose: 'bg-rose-400/15 text-rose-200 ring-rose-300/30',
};

export const TONE_DOT: Record<Tone, string> = {
  slate: 'bg-white/60',
  violet: 'bg-violet-300',
  blue: 'bg-indigo-300',
  sky: 'bg-sky-300',
  amber: 'bg-amber-300',
  emerald: 'bg-emerald-300',
  rose: 'bg-rose-300',
};

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const itemKindLabel = (k: ItemKind) => (k === 'laundry_bag' ? 'Laundry bag' : 'Package');

export function locationLabel(loc: ItemLocation, shopLabel: string) {
  if (loc === 'home') return 'At home';
  if (loc === 'robot') return 'On the robot';
  return `At ${titleCase(shopLabel)}`;
}

/** Argument shown next to the action in mono, e.g. MOVE_TO dry_cleaner / WAIT 4s. */
export function stepArg(s: PlanStep) {
  if (s.action === 'WAIT') return s.durationMs != null ? `${+(s.durationMs / 1000).toFixed(1)}s` : '';
  if (s.action === 'REPORT_STATUS') return '';
  return s.target ?? '';
}

export const stepText = (s: PlanStep) => [s.action, stepArg(s)].filter(Boolean).join(' ');

export const timeLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
