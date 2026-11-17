// File-backed OAuth client provider for Wajo Fo's MCP server. Persists to .fo-auth.json (chmod 600, gitignored).
// Never log the contents of this file.
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';

export const FO_MCP_URL = 'https://mcp.api.wajo.ai/fo';
export const FO_REDIRECT_PORT = 8790;
export const FO_REDIRECT_URL = `http://localhost:${FO_REDIRECT_PORT}/callback`;
const AUTH_FILE = resolve(process.cwd(), '.fo-auth.json');

interface AuthState {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}

function load(): AuthState {
  if (!existsSync(AUTH_FILE)) return {};
  try {
    return JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as AuthState;
  } catch {
    return {};
  }
}

function save(state: AuthState) {
  writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  chmodSync(AUTH_FILE, 0o600);
}

const update = (patch: Partial<AuthState>) => save({ ...load(), ...patch });

export const hasFoTokens = () => Boolean(load().tokens?.access_token);

export class FileOAuthProvider implements OAuthClientProvider {
  /** onRedirect set = interactive login (fo-login.ts). Without it (the API server) we never start a new auth flow,
   * so a running server can't clobber the PKCE verifier of an in-progress login. */
  constructor(private onRedirect?: (url: URL) => void) {}

  get redirectUrl() {
    return FO_REDIRECT_URL;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'FoWorld',
      redirect_uris: [FO_REDIRECT_URL],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'mcp',
    };
  }

  clientInformation() {
    return load().clientInformation;
  }
  saveClientInformation(clientInformation: OAuthClientInformationMixed) {
    update({ clientInformation });
  }
  tokens() {
    return load().tokens;
  }
  saveTokens(tokens: OAuthTokens) {
    update({ tokens });
  }
  saveCodeVerifier(codeVerifier: string) {
    if (this.onRedirect) update({ codeVerifier });
  }
  codeVerifier() {
    const v = load().codeVerifier;
    if (!v) throw new Error('No PKCE code verifier saved');
    return v;
  }
  redirectToAuthorization(url: URL) {
    // Server side (no browser): signal that interactive login is required.
    if (this.onRedirect) this.onRedirect(url);
  }
  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery') {
    const s = load();
    if (scope === 'all' || scope === 'client') delete s.clientInformation;
    if (scope === 'all' || scope === 'tokens') delete s.tokens;
    if (scope === 'all' || scope === 'verifier') delete s.codeVerifier;
    save(s);
  }
}
