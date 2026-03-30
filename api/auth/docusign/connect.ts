/**
 * OAuth initiation endpoint for DocuSign.
 *
 * GET /api/auth/docusign/connect?key=<api_key>
 *
 * Generates a PKCE code verifier + challenge, stores the verifier in a
 * short-lived cookie, and redirects the user to DocuSign's authorization page.
 */

import type { HttpRequest, HttpResponse } from '../../_http-types.js';
import { randomBytes, createHash } from 'node:crypto';

const DOCUSIGN_AUTH_BASE = 'https://account-d.docusign.com'; // sandbox
const INTEGRATION_KEY = process.env.OA_DOCUSIGN_INTEGRATION_KEY || '';
const REDIRECT_URI = process.env.OA_DOCUSIGN_REDIRECT_URI || 'https://openagreements.ai/api/auth/docusign/callback';

function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query[key];
  return Array.isArray(val) ? val[0] : val;
}

export default function handler(req: HttpRequest, res: HttpResponse): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = getQuery(req, 'key');
  if (!apiKey) {
    res.status(400).json({ error: 'Missing "key" query parameter (your open_agreements_api_key)' });
    return;
  }

  if (!INTEGRATION_KEY) {
    res.status(500).json({ error: 'DocuSign integration key not configured' });
    return;
  }

  // Generate PKCE
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // Generate CSRF state (includes api_key for callback lookup)
  const csrfToken = randomBytes(16).toString('hex');
  const state = `${csrfToken}:${apiKey}`;

  // Store code_verifier in a short-lived httpOnly cookie (5 min TTL)
  res.setHeader('Set-Cookie', [
    `oa_pkce_verifier=${codeVerifier}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `oa_oauth_state=${csrfToken}; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  ]);

  // Build DocuSign authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    scope: 'signature extended',
    client_id: INTEGRATION_KEY,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${DOCUSIGN_AUTH_BASE}/oauth/auth?${params.toString()}`;

  // Redirect to DocuSign
  res.setHeader('Location', authUrl);
  res.status(302).end();
}
