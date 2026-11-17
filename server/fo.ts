// Wajo Fo over MCP (streamable HTTP + OAuth tokens from `npm run fo:login`). Never throws to callers.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { FoAskResponse, FoStatusResponse } from '../shared/api';
import { FO_MCP_URL, FileOAuthProvider, hasFoTokens } from './fo-auth';

const ASK_TIMEOUT_MS = 90_000;
const REPLY_WAIT_SECONDS = 20;
const REPLY_TIMEOUT_MS = 35_000;
const LOGIN_HINT = 'Fo is not signed in. Run `npm run fo:login`.';

const coordinationPrompt = (request: string) =>
  `I'm coordinating a physical errand: "${request}". A delivery robot at my home will physically carry the items, so don't arrange any human pickup or transportation. Find the right nearby business for this errand (e.g. a dry cleaner that accepts drop-offs) and tell me its name, address, hours, typical price, and any drop-off/pickup requirements. This is a test run — do NOT place phone calls, make bookings, or spend money; research and report back only. Keep it under 100 words.`;
const followUpPrompt = (message: string) =>
  `${message}\n\n(Test run: research and report only. Do NOT place calls, make bookings, or spend money.)`;

interface Conn { client: Client; tools: Tool[] }
let conn: Promise<Conn> | null = null;

async function connect(): Promise<Conn> {
  if (!hasFoTokens()) throw new UnauthorizedError(LOGIN_HINT);
  const client = new Client({ name: 'FoWorld', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(FO_MCP_URL), { authProvider: new FileOAuthProvider() });
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`[fo] connected, tools: ${tools.map((t) => t.name).join(', ')}`);
  return { client, tools };
}

function getConn(): Promise<Conn> {
  if (!conn) {
    conn = connect();
    conn.catch(() => { conn = null; });
  }
  return conn;
}

const isAuthError = (err: unknown) =>
  err instanceof UnauthorizedError || /unauthori[sz]ed|401|invalid_grant|invalid_token/i.test(String((err as Error)?.message ?? err));
const errMsg = (err: unknown) => (isAuthError(err) ? LOGIN_HINT : `Fo error: ${(err as Error)?.message ?? String(err)}`);

// Real shapes (discovered via listTools):
//   ask_fo        in {message, conversationId?, newConversation?}
//   get_fo_reply  in {conversationId?, waitSeconds? (0-40, default 40)}
//   both out (structuredContent) {response, status: 'complete'|'working'|'failed', conversationId, progress?, elapsedSeconds?}
interface FoToolOutput { response?: string; status?: string; conversationId?: string; progress?: string; elapsedSeconds?: number }

// FoAskResponse plus Fo's one-line progress while working (extra field; not yet in shared/api.ts).
export type FoResult = FoAskResponse & { progress?: string };

function parseResult(result: CallToolResult, fallbackConversationId: string | null): FoResult {
  const text = result.content.flatMap((c) => (c.type === 'text' ? [c.text] : [])).join('\n');
  let out = result.structuredContent as FoToolOutput | undefined;
  if (!out) {
    try { out = JSON.parse(text) as FoToolOutput; } catch { out = { response: text, status: result.isError ? 'failed' : 'complete' }; }
  }
  const conversationId = out.conversationId ?? fallbackConversationId;
  const response = out.response?.trim() || null;
  if (result.isError || out.status === 'failed') {
    return { ok: false, status: 'error', conversationId, reply: null, error: response ?? (text || 'Fo could not complete the request') };
  }
  if (out.status === 'working') {
    return { ok: true, status: 'pending', conversationId, reply: null, ...(out.progress && { progress: out.progress }) };
  }
  return { ok: true, status: response ? 'complete' : 'pending', conversationId, reply: response };
}

async function callTool(name: string, args: Record<string, unknown>, timeout: number, conversationId: string | null): Promise<FoResult> {
  if (!hasFoTokens()) return { ok: false, status: 'unauthenticated', conversationId, reply: null, error: LOGIN_HINT };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { client, tools } = await getConn();
      if (!tools.some((t) => t.name === name)) return { ok: false, status: 'error', conversationId, reply: null, error: `Fo tool "${name}" not available` };
      const t0 = Date.now();
      const result = (await client.callTool({ name, arguments: args }, undefined, { timeout })) as CallToolResult;
      const parsed = parseResult(result, conversationId);
      console.log(`[fo] ${name} ${Date.now() - t0}ms -> ${parsed.status}`);
      return parsed;
    } catch (err) {
      if (isAuthError(err)) return { ok: false, status: 'unauthenticated', conversationId, reply: null, error: LOGIN_HINT };
      console.error(`[fo] ${name} failed (attempt ${attempt + 1}): ${(err as Error)?.message}`);
      // Stale session? Drop the connection and reconnect once.
      const stale = conn;
      conn = null;
      stale?.then((c) => c.client.close()).catch(() => {});
      if (attempt === 1) return { ok: false, status: 'error', conversationId, reply: null, error: errMsg(err) };
    }
  }
  return { ok: false, status: 'error', conversationId, reply: null, error: 'unreachable' };
}

// Single-flight: identical in-flight asks share one Fo task.
const inflight = new Map<string, Promise<FoResult>>();

export function askFo(userRequest: string, conversationId?: string): Promise<FoResult> {
  const key = `${conversationId ?? ''}\u0000${userRequest}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const text = conversationId ? followUpPrompt(userRequest) : coordinationPrompt(userRequest);
  // A new errand starts a fresh Fo conversation rather than continuing whatever the user last discussed with Fo.
  const args = conversationId ? { message: text, conversationId } : { message: text, newConversation: true };
  const p = callTool('ask_fo', args, ASK_TIMEOUT_MS, conversationId ?? null).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Long-polls Fo for up to REPLY_WAIT_SECONDS. */
export function getFoReply(conversationId: string): Promise<FoResult> {
  return callTool('get_fo_reply', { conversationId, waitSeconds: REPLY_WAIT_SECONDS }, REPLY_TIMEOUT_MS, conversationId);
}

export async function getFoStatus(): Promise<FoStatusResponse> {
  if (!hasFoTokens()) return { connected: false, authenticated: false, tools: [], error: LOGIN_HINT };
  try {
    const { tools } = await getConn();
    return { connected: true, authenticated: true, tools: tools.map((t) => t.name) };
  } catch (err) {
    return { connected: false, authenticated: !isAuthError(err), tools: [], error: errMsg(err) };
  }
}
