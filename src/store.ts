// Single shared client state (zustand). The simulator (src/sim) WRITES; world (src/world) and UI (src/ui) READ.
// UI may call orchestrator functions from src/sim/orchestrator.ts but should not mutate workflow state directly
// (exceptions: `selected`, and `camera` for user-driven camera buttons).
import { create } from 'zustand';
import type { RobotPlan, SceneSpec, Vec3, WorkflowStage, WorldEvent } from '../shared/types';
import { DEFAULT_SCENE, WAYPOINTS } from '../shared/world';

export type ItemLocation = 'home' | 'robot' | 'shop';
export type Selectable = 'robot' | 'home' | 'shop' | 'item';

export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; ts: number }

/** Activity stream entry. verified=true ONLY for text that genuinely came from Fo / Claude.
 *  verified=false entries are staged/simulated and the UI must label them as such (PRD §8.4). */
export interface ActivityEntry {
  id: string;
  ts: number;
  source: 'fo' | 'claude' | 'robot' | 'system';
  text: string;
  verified: boolean;
  status: 'pending' | 'done' | 'error';
}

export interface ApprovalRequest {
  title: string;        // "Approve dry-cleaning charge?"
  amount: string;       // "$18.50"
  detail: string;       // "Quote from Fo" / "Estimated quote"
  source: 'fo_quote' | 'demo';
}

export interface ChecklistItem { id: string; label: string; status: 'pending' | 'active' | 'done' | 'error' }

export interface FoWorldState {
  stage: WorkflowStage;
  task: { id: string; title: string; request: string; mode: 'live' | 'demo' } | null;
  checklist: ChecklistItem[];          // high-level progress shown in the task panel
  plan: RobotPlan | null;
  planSource: 'claude' | 'fallback' | 'demo' | null;
  activeStepIndex: number;             // index into plan.steps; -1 when idle
  robot: { status: string; moving: boolean };  // pose lives in `robotPose` (mutable, non-reactive)
  item: { location: ItemLocation; clean: boolean };
  route: Vec3[] | null;                // polyline of the current/planned route (glowing path)
  shopActive: boolean;                 // shop lights up during handoff / service
  highlights: Selectable[];            // objects to emphasize (outline/pulse)
  camera: { mode: 'overview' | 'focus' | 'follow'; target?: Vec3 };
  messages: ChatMessage[];
  activity: ActivityEntry[];
  events: WorldEvent[];
  approval: ApprovalRequest | null;
  toast: string | null;
  selected: Selectable | null;
  scene: SceneSpec;
  fo: { connected: boolean | null; authenticated: boolean | null; conversationId: string | null };
}

export const initialState = (): FoWorldState => ({
  stage: 'IDLE',
  task: null,
  checklist: [],
  plan: null,
  planSource: null,
  activeStepIndex: -1,
  robot: { status: 'Idle — ready', moving: false },
  item: { location: 'home', clean: false },
  route: null,
  shopActive: false,
  highlights: [],
  camera: { mode: 'overview' },
  messages: [],
  activity: [],
  events: [],
  approval: null,
  toast: null,
  selected: null,
  scene: DEFAULT_SCENE,
  fo: { connected: null, authenticated: null, conversationId: null },
});

export const useFoStore = create<FoWorldState>()(() => initialState());

/** Robot pose, mutated every frame by the simulator. Read it inside useFrame via `robotPose.position`;
 *  never put it in React state (avoids 60fps re-renders). heading = Math.atan2(dx, dz). */
export const robotPose: { position: Vec3; heading: number } = {
  position: [...WAYPOINTS.home] as Vec3,
  heading: Math.PI, // facing the house (-Z) while parked
};

let _id = 0;
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(_id++).toString(36)}`;

// Dev-only handle for debugging/screenshots: `window.__fo.useFoStore.setState(...)`, `window.__fo.robotPose`.
// (Importing /src/store.ts from devtools can return a different HMR module instance than the app's.)
if (import.meta.env.DEV) (window as unknown as { __fo: unknown }).__fo = { useFoStore, robotPose };
