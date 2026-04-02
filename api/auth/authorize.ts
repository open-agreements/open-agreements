/**
 * OAuth Authorization Endpoint
 * GET /api/auth/authorize
 *
 * Branded consent page → proxy to DocuSign OAuth.
 *
 * Required params: client_id, redirect_uri, response_type=code,
 *   code_challenge, code_challenge_method=S256, state, scope, resource
 *
 * Flow:
 * 1. Validate client_id against DCR registration
 * 2. Exact-match redirect_uri (port-agnostic for localhost per RFC 8252 §7.3)
 * 3. Show branded consent page (or skip if consent already granted)
 * 4. On "Allow", generate OA auth code, store in Firestore
 * 5. Redirect to DocuSign OAuth with OA state
 * 6. DocuSign callback stores DS tokens, then redirects to client with OA code
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { randomBytes, createHash } from 'node:crypto';

const OA_ORIGIN = process.env.OA_ORIGIN?.trim() || 'https://openagreements.org';
const MCP_RESOURCE = `${OA_ORIGIN}/api/mcp`;
const DOCUSIGN_AUTH_BASE = (process.env.OA_DOCUSIGN_SANDBOX?.trim() === 'false')
  ? 'https://account.docusign.com'
  : 'https://account-d.docusign.com';
const INTEGRATION_KEY = process.env.OA_DOCUSIGN_INTEGRATION_KEY?.trim() || '';
const DS_REDIRECT_URI = process.env.OA_DOCUSIGN_REDIRECT_URI?.trim() || `${OA_ORIGIN}/api/auth/docusign/callback`;

let _db: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (_db) return _db;
  const { Firestore } = await import('@google-cloud/firestore');
  _db = new Firestore({ projectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT });
  return _db;
}

function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query?.[key];
  return Array.isArray(val) ? val[0] : val;
}

function matchRedirectUri(registered: string[], requested: string): boolean {
  const req = new URL(requested);
  const isLoopback = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  for (const uri of registered) {
    const reg = new URL(uri);
    if (isLoopback && (reg.hostname === 'localhost' || reg.hostname === '127.0.0.1')) {
      // RFC 8252 §7.3: match scheme, host, path — ignore port for loopback
      if (req.protocol === reg.protocol && req.pathname === reg.pathname) return true;
    } else {
      // Exact match for non-loopback
      if (requested === uri) return true;
    }
  }
  return false;
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'invalid_request', error_description: 'GET only' });
    return;
  }

  const clientId = getQuery(req, 'client_id');
  const redirectUri = getQuery(req, 'redirect_uri');
  const responseType = getQuery(req, 'response_type');
  const codeChallenge = getQuery(req, 'code_challenge');
  const codeChallengeMethod = getQuery(req, 'code_challenge_method');
  const state = getQuery(req, 'state');
  const scope = getQuery(req, 'scope');
  const resource = getQuery(req, 'resource');

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge || !state) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters: client_id, redirect_uri, code_challenge, state',
    });
    return;
  }

  if (responseType !== 'code') {
    res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' });
    return;
  }

  if (codeChallengeMethod !== 'S256') {
    res.status(400).json({ error: 'invalid_request', error_description: 'Only code_challenge_method=S256 is supported' });
    return;
  }

  if (resource && resource !== MCP_RESOURCE) {
    res.status(400).json({ error: 'invalid_target', error_description: `Resource must be ${MCP_RESOURCE}` });
    return;
  }

  // Look up client registration
  const db = await getDb();
  const clientDoc = await db.collection('oauth_clients').doc(clientId).get();
  if (!clientDoc.exists) {
    res.status(400).json({ error: 'invalid_client', error_description: 'Client not registered. Use /api/auth/register first.' });
    return;
  }

  const client = clientDoc.data()!;

  // Validate redirect URI (port-agnostic for localhost)
  if (!matchRedirectUri(client.redirect_uris, redirectUri)) {
    res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uri does not match any registered URI for this client',
    });
    return;
  }

  // Update last_used_at (resets 90-day TTL)
  await clientDoc.ref.update({ last_used_at: new Date().toISOString() });

  // Generate OA auth code (will be exchanged at /api/auth/token)
  const oaCode = randomBytes(32).toString('base64url');

  // Store auth code in Firestore (60-second TTL, single-use)
  await db.collection('oauth_codes').doc(oaCode).set({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    resource: MCP_RESOURCE,
    state,
    scope: scope || 'signing',
    used: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(), // 60 seconds
  });

  // Generate PKCE for DocuSign (separate from client's PKCE to OA)
  const dsCodeVerifier = randomBytes(32).toString('base64url');
  const dsCodeChallenge = createHash('sha256').update(dsCodeVerifier).digest('base64url');

  // Store DS PKCE verifier + OA code in cookies for the callback to pick up
  const csrfToken = randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', [
    `oa_ds_verifier=${dsCodeVerifier}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oa_ds_state=${csrfToken}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oa_auth_code=${oaCode}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oa_client_redirect=${encodeURIComponent(redirectUri)}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oa_client_state=${encodeURIComponent(state)}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  ]);

  // For now, skip consent page and redirect directly to DocuSign
  // TODO: Add branded consent page that checks oauth_consents collection
  // If consent exists for this client_id, skip. Otherwise show consent UI.
  const dsState = `${csrfToken}:mcp-oauth`;

  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature extended',
    client_id: INTEGRATION_KEY,
    redirect_uri: DS_REDIRECT_URI,
    code_challenge: dsCodeChallenge,
    code_challenge_method: 'S256',
    state: dsState,
  });

  res.writeHead(302, { Location: `${DOCUSIGN_AUTH_BASE}/oauth/auth?${params}` });
  res.end();
}
