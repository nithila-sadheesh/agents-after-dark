// HTTP contract between the Vite client and the Node server (server listens on :8787, Vite proxies /api).
import type { RobotPlan, SceneSpec } from './types';

// POST /api/plan  — Claude turns the request into a validated robot plan (+ optional scene variant)
export interface PlanRequest { request: string }
export interface PlanResponse {
  plan: RobotPlan;
  source: 'claude' | 'fallback';  // 'fallback' = Claude unavailable or plan failed validation; DEMO_PLAN used
  summary: string;                // one short assistant sentence for the chat, e.g. "Coordinating the cleaner and preparing your robot."
  scene: SceneSpec;               // DEFAULT_SCENE unless the request implies another task (e.g. package return)
  errors?: string[];              // validation / API errors when source === 'fallback'
}

// POST /api/fo/ask — sends a genuine request to Wajo Fo via MCP (ask_fo)
export interface FoAskRequest { message: string; conversationId?: string }
export interface FoAskResponse {
  ok: boolean;
  status: 'complete' | 'pending' | 'error' | 'unauthenticated';
  conversationId: string | null;
  reply: string | null;           // Fo's text reply, verbatim, when available
  progress?: string;              // Fo's own one-line progress note while status === 'pending'
  error?: string;
}

// GET /api/fo/reply?conversationId=...  — polls get_fo_reply; same FoAskResponse shape

// GET /api/fo/status
export interface FoStatusResponse {
  connected: boolean;             // MCP session established
  authenticated: boolean;         // OAuth tokens present/valid (run `npm run fo:login` otherwise)
  tools: string[];
  error?: string;
}
