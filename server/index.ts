// FoWorld API server (HTTP contract: shared/api.ts).
import 'dotenv/config';
import express from 'express';
import type { FoAskRequest, PlanRequest } from '../shared/api';
import { askFo, getFoReply, getFoStatus } from './fo';
import { planRequest } from './planner';

const PORT = Number(process.env.PORT) || 8787;
const MAX_REQUEST_CHARS = 2000;
const app = express();

app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t0}ms`));
  next();
});

const badRequest = (res: express.Response, error: string) => res.status(400).json({ error });
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_REQUEST_CHARS;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, claude: Boolean(process.env.ANTHROPIC_API_KEY), ts: Date.now() });
});

app.post('/api/plan', async (req, res) => {
  const body = req.body as Partial<PlanRequest> | undefined;
  if (!nonEmpty(body?.request)) return badRequest(res, `"request" must be a non-empty string (max ${MAX_REQUEST_CHARS} chars)`);
  res.json(await planRequest(body.request.trim()));
});

app.post('/api/fo/ask', async (req, res) => {
  const body = req.body as Partial<FoAskRequest> | undefined;
  if (!nonEmpty(body?.message)) return badRequest(res, `"message" must be a non-empty string (max ${MAX_REQUEST_CHARS} chars)`);
  if (body.conversationId !== undefined && !nonEmpty(body.conversationId)) return badRequest(res, '"conversationId" must be a string');
  res.json(await askFo(body.message.trim(), body.conversationId));
});

app.get('/api/fo/reply', async (req, res) => {
  const id = req.query.conversationId;
  if (!nonEmpty(id)) return badRequest(res, '"conversationId" query parameter is required');
  res.json(await getFoReply(id));
});

app.get('/api/fo/status', async (_req, res) => {
  res.json(await getFoStatus());
});

// Malformed JSON bodies -> 400 instead of express's default HTML error page.
app.use((err: Error & { status?: number; type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error('[server] error:', err.message);
  res.status(status).json({ error: status === 500 ? 'Internal error' : err.message });
});

app.listen(PORT, () => console.log(`[server] FoWorld API listening on http://localhost:${PORT}`));
