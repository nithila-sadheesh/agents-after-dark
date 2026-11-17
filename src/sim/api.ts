// Thin fetch wrappers for the backend contract in shared/api.ts (Vite proxies /api → :8787).
import type { FoAskResponse, FoStatusResponse, PlanResponse } from '../../shared/api';

async function call<T>(path: string, timeoutMs: number, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  // Non-2xx responses may still carry a contract-shaped JSON body (e.g. Fo 'unauthenticated'); callers validate shape.
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') throw new Error(`${path}: HTTP ${res.status}`);
  return json as T;
}

export async function fetchPlan(request: string): Promise<PlanResponse> {
  const r = await call<PlanResponse>('/api/plan', 60_000, { request });
  if (!r.plan?.steps?.length) throw new Error('plan response missing steps');
  return r;
}

const checkFo = (r: FoAskResponse) => {
  if (!r.status) throw new Error('malformed Fo response');
  return r;
};

export const foAsk = async (message: string, conversationId?: string) =>
  checkFo(await call<FoAskResponse>('/api/fo/ask', 90_000, { message, conversationId }));

export const foReply = async (conversationId: string) =>
  checkFo(await call<FoAskResponse>(`/api/fo/reply?conversationId=${encodeURIComponent(conversationId)}`, 30_000));

export const foApprove = async (conversationId: string, amount: string) =>
  checkFo(await call<FoAskResponse>('/api/fo/approve', 90_000, { conversationId, amount }));

export const foStatus = () => call<FoStatusResponse>('/api/fo/status', 10_000);
