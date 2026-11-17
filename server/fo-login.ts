// `npm run fo:login` — one-time OAuth sign-in to Wajo Fo's MCP server. Stores tokens in .fo-auth.json.
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { FO_MCP_URL, FO_REDIRECT_PORT, FileOAuthProvider } from './fo-auth';

const TIMEOUT_MS = 10 * 60_000;

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${FO_REDIRECT_PORT}`);
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(code ? 200 : 400, { 'Content-Type': 'text/html' });
      res.end(code
        ? '<h2>FoWorld is connected to Fo.</h2><p>You can close this tab.</p>'
        : `<h2>Fo sign-in failed</h2><p>${(error ?? 'no code').replace(/[<>&]/g, '')}</p>`);
      server.close();
      if (code) resolve(code); else reject(new Error(`Authorization failed: ${error ?? 'no code'}`));
    });
    server.on('error', reject);
    server.listen(FO_REDIRECT_PORT, () => console.log(`[fo-login] callback server on http://localhost:${FO_REDIRECT_PORT}/callback`));
  });
}

async function connect(provider: FileOAuthProvider) {
  const client = new Client({ name: 'FoWorld', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(FO_MCP_URL), { authProvider: provider });
  await client.connect(transport);
  return { client, transport };
}

async function main() {
  let codePromise: Promise<string> | null = null;
  const provider = new FileOAuthProvider((url) => {
    codePromise = waitForCode(); // listen before the browser opens
    console.log(`[fo-login] Opening Wajo sign-in in your browser. If it doesn't open, visit:\n${url.toString()}\n`);
    execFile('open', [url.toString()], (err) => err && console.warn(`[fo-login] could not open browser: ${err.message}`));
  });

  let client: Client;
  try {
    ({ client } = await connect(provider));
    console.log('[fo-login] Already authenticated.');
  } catch (err) {
    if (!(err instanceof UnauthorizedError) || !codePromise) throw err;
    const code = await codePromise;
    // Finish with a fresh transport bound to the same provider, then reconnect.
    const transport = new StreamableHTTPClientTransport(new URL(FO_MCP_URL), { authProvider: provider });
    await transport.finishAuth(code);
    console.log('[fo-login] Authorization complete, tokens saved.');
    ({ client } = await connect(provider));
  }

  const { tools } = await client.listTools();
  console.log(`[fo-login] ${tools.length} tools:`);
  for (const t of tools) {
    console.log(`\n## ${t.name}\n${t.description ?? ''}\ninputSchema: ${JSON.stringify(t.inputSchema)}`);
    if (t.outputSchema) console.log(`outputSchema: ${JSON.stringify(t.outputSchema)}`);
  }
  await client.close();
}

const timer = setTimeout(() => { console.error('[fo-login] Timed out after 10 minutes.'); process.exit(1); }, TIMEOUT_MS);
main()
  .then(() => { clearTimeout(timer); process.exit(0); })
  .catch((err) => { console.error(`[fo-login] failed: ${err instanceof Error ? err.message : String(err)}`); process.exit(1); });
