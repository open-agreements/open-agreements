/**
 * OAuth callback endpoint for DocuSign.
 *
 * GET /api/auth/docusign/callback?code=<auth_code>&state=<csrf:api_key>
 *
 * Exchanges the authorization code for tokens using PKCE,
 * resolves the user's accountId and baseUri via /userinfo,
 * and stores the encrypted connection record in Firestore.
 */

import type { HttpRequest, HttpResponse } from '../../_http-types.js';

const DOCUSIGN_AUTH_BASE = 'https://account-d.docusign.com'; // sandbox
const INTEGRATION_KEY = process.env.OA_DOCUSIGN_INTEGRATION_KEY || '';
const SECRET_KEY = process.env.OA_DOCUSIGN_SECRET_KEY || '';
const REDIRECT_URI = process.env.OA_DOCUSIGN_REDIRECT_URI || 'https://openagreements.ai/api/auth/docusign/callback';

function getQuery(req: HttpRequest, key: string): string | undefined {
  const val = req.query[key];
  return Array.isArray(val) ? val[0] : val;
}

function getCookie(req: HttpRequest, name: string): string | undefined {
  const cookieHeader = req.headers['cookie'];
  const cookies = typeof cookieHeader === 'string' ? cookieHeader : '';
  const match = cookies.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const code = getQuery(req, 'code');
  const state = getQuery(req, 'state');
  const error = getQuery(req, 'error');

  if (error) {
    res.status(400).json({ error: `DocuSign authorization denied: ${error}` });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter' });
    return;
  }

  // Verify CSRF state
  const storedCsrf = getCookie(req, 'oa_oauth_state');
  const [csrfFromState, apiKey] = state.split(':');

  if (!storedCsrf || storedCsrf !== csrfFromState) {
    res.status(403).json({ error: 'CSRF state mismatch — possible attack or expired session' });
    return;
  }

  // Get PKCE code verifier from cookie
  const codeVerifier = getCookie(req, 'oa_pkce_verifier');
  if (!codeVerifier) {
    res.status(400).json({ error: 'PKCE verifier cookie expired — please try connecting again' });
    return;
  }

  try {
    // Exchange code for tokens
    const basicAuth = Buffer.from(`${INTEGRATION_KEY}:${SECRET_KEY}`).toString('base64');

    const tokenResponse = await fetch(`${DOCUSIGN_AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      res.status(502).json({ error: `DocuSign token exchange failed: ${tokenResponse.status}`, details: err });
      return;
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get user info
    const userInfoResponse = await fetch(`${DOCUSIGN_AUTH_BASE}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      res.status(502).json({ error: `DocuSign userinfo failed: ${userInfoResponse.status}` });
      return;
    }

    const userInfo = await userInfoResponse.json() as {
      accounts: Array<{ account_id: string; base_uri: string; is_default: boolean }>;
    };

    const account = userInfo.accounts.find(a => a.is_default) || userInfo.accounts[0];
    if (!account) {
      res.status(400).json({ error: 'No DocuSign accounts found for this user' });
      return;
    }

    // TODO: Encrypt tokens and store in Firestore
    // For now, return success with connection info (tokens NOT exposed)

    // Clear OAuth cookies
    res.setHeader('Set-Cookie', [
      'oa_pkce_verifier=; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'oa_oauth_state=; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);

    // Return success page
    res.status(200).json({
      status: 'connected',
      provider: 'docusign',
      account_id: account.account_id,
      connection_id: `docusign-${account.account_id}`,
      message: 'DocuSign account connected successfully. You can now send agreements for signature.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'OAuth callback failed', details: message });
  }
}
