// Shared contracts between client (src/) and server (server/). Keep in sync; do not rename fields.
export type Vec3 = [number, number, number];

// ---- Robot execution language (PRD §9.1) ----
export const ACTIONS = ['MOVE_TO', 'PICK_UP', 'DROP_OFF', 'WAIT', 'RETURN_HOME', 'REPORT_STATUS'] as const;
export type ActionName = (typeof ACTIONS)[number];

export interface PlanStep {
  action: ActionName;
  target?: string;      // waypoint id/alias (MOVE_TO, DROP_OFF) or item id (PICK_UP)
  durationMs?: number;  // WAIT only
  message?: string;     // REPORT_STATUS only, or a human label for any step
}

export interface RobotPlan {
  taskId: string;
  objective: string;
  robotId: string;      // 'buggy-01'
  steps: PlanStep[];
}

// ---- Workflow lifecycle (PRD §11.1) ----
export type WorkflowStage =
  | 'IDLE' | 'PLANNING' | 'COORDINATING' | 'NEEDS_APPROVAL' | 'READY'
  | 'PICKING_UP' | 'TRAVELING' | 'DROPPING_OFF' | 'SERVICE_PENDING'
  | 'RETURNING' | 'COMPLETED' | 'FAILED';

// ---- Semantic events (PRD §11.2) ----
export type WorldEventType =
  | 'task.started' | 'agent.coordination_started' | 'agent.reply' | 'agent.booking_confirmed'
  | 'agent.approval_required' | 'robot.plan_created' | 'robot.pickup_started' | 'robot.pickup_completed'
  | 'robot.moving' | 'robot.arrived' | 'robot.dropoff_completed' | 'service.completed'
  | 'robot.returning' | 'task.completed' | 'task.failed';

export interface WorldEvent {
  type: WorldEventType;
  ts: number;
  robotId?: string;
  target?: string;
  progress?: number;    // 0..1 for robot.moving
  detail?: string;
}

// ---- Scene specification (PRD §10.2) ----
export type ItemKind = 'laundry_bag' | 'package';
export type SceneObjectType = 'house' | 'store' | 'tree' | 'lamp' | 'car' | 'bush' | 'bench' | 'mailbox';

export interface SceneObject {
  id: string;           // 'home' and 'shop' are reserved and pinned to HOME_ANCHOR / SHOP_ANCHOR
  type: SceneObjectType;
  position: Vec3;
  rotation?: number;    // radians around Y
  label?: string;       // storefront sign text for 'store'
  color?: string;       // hex
  scale?: number;
}

export interface SceneSpec {
  environment: 'suburban_neighborhood';
  camera: 'isometric';
  shopLabel: string;    // e.g. "DRY CLEANERS" / "SHIP & POST"
  itemKind: ItemKind;
  accent?: string;      // hex accent for glow/route
  objects: SceneObject[];
}
