import type { ItemKind, PlanStep, WorkflowStage } from '../../shared/types';
import type { ItemLocation } from '../store';
import { DEMO_REQUEST } from '../sim/orchestrator';

/** Solid white surface: hairline border, one very soft neutral shadow to lift it off the 3D scene. */
export const SURFACE =
  'border border-[#e8e8e8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-14px_rgba(0,0,0,0.18)]';
export const CARD = `rounded-3xl ${SURFACE}`;

export const isRunning = (s: WorkflowStage) => s !== 'IDLE' && s !== 'COMPLETED' && s !== 'FAILED';

/** solid = black pill (work in progress / done), outline = needs you, soft = grey (idle / failed). */
export type Tone = 'solid' | 'outline' | 'soft';

export const STAGE_META: Record<WorkflowStage, { label: string; tone: Tone }> = {
  IDLE: { label: 'Idle', tone: 'soft' },
  PLANNING: { label: 'Planning', tone: 'solid' },
  COORDINATING: { label: 'Coordinating with Fo', tone: 'solid' },
  NEEDS_APPROVAL: { label: 'Needs approval', tone: 'outline' },
  READY: { label: 'Ready to roll', tone: 'solid' },
  PICKING_UP: { label: 'Picking up', tone: 'solid' },
  TRAVELING: { label: 'En route', tone: 'solid' },
  DROPPING_OFF: { label: 'Dropping off', tone: 'solid' },
  SERVICE_PENDING: { label: 'Service in progress', tone: 'solid' },
  RETURNING: { label: 'Returning home', tone: 'solid' },
  COMPLETED: { label: 'Completed', tone: 'solid' },
  FAILED: { label: 'Failed', tone: 'soft' },
};

export const TONE_PILL: Record<Tone, string> = {
  solid: 'bg-[#0a0a0a] text-white',
  outline: 'bg-white text-[#0a0a0a] ring-1 ring-[#0a0a0a]',
  soft: 'bg-[#f3f3f3] text-[#525252]',
};

export const TONE_DOT: Record<Tone, string> = {
  solid: 'bg-white',
  outline: 'bg-[#0a0a0a]',
  soft: 'bg-[#a3a3a3]',
};

export const SUGGESTIONS = [
  { label: 'Get my clothes dry-cleaned with my Rover S6 buggy', request: DEMO_REQUEST, icon: 'hanger' },
  { label: 'Return my package to the shipping store', request: 'Return my package to the shipping store', icon: 'box' },
] as const;

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
