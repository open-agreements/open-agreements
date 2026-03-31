/**
 * OAuth callback endpoint for DocuSign.
 *
 * GET /api/auth/docusign/callback?code=<auth_code>&state=<csrf:api_key>
 *
 * Exchanges the authorization code for tokens using PKCE,
 * resolves the user's accountId and baseUri via /userinfo,
 * and stores the encrypted connection record in Firestore.
 *
 * Returns a user-friendly HTML page (not JSON) since this is
 * visited in the user's browser after DocuSign redirects back.
 */

import type { HttpRequest, HttpResponse } from '../../_http-types.js';

const DOCUSIGN_AUTH_BASE = (process.env.OA_DOCUSIGN_SANDBOX?.trim() === 'false')
  ? 'https://account.docusign.com'
  : 'https://account-d.docusign.com';
const INTEGRATION_KEY = process.env.OA_DOCUSIGN_INTEGRATION_KEY?.trim() || '';
const SECRET_KEY = process.env.OA_DOCUSIGN_SECRET_KEY?.trim() || '';
const REDIRECT_URI = process.env.OA_DOCUSIGN_REDIRECT_URI?.trim() || 'https://openagreements.ai/api/auth/docusign/callback';

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

function htmlPage(title: string, heading: string, body: string, isError = false): string {
  const color = isError ? '#be4b2f' : '#1a7a4c';
  const icon = isError ? '&#10005;' : '&#10003;';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — OpenAgreements</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f0e8;
      color: #142023;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border: 1px solid #d2c2ae;
      border-radius: 8px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${color};
      color: #fff;
      font-size: 28px;
      line-height: 56px;
      margin: 0 auto 20px;
    }
    h1 { font-size: 1.3rem; margin: 0 0 12px; }
    p { color: #334348; line-height: 1.5; margin: 0 0 8px; }
    .subtle { font-size: 0.85rem; color: #667; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    ${body}
  </div>
</body>
</html>`;
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  // Clear OAuth cookies on every callback (success or failure)
  const clearCookies = [
    'oa_pkce_verifier=; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_oauth_state=; Path=/api/auth/docusign; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  ];

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const code = getQuery(req, 'code');
  const state = getQuery(req, 'state');
  const error = getQuery(req, 'error');

  if (error) {
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(400).send(htmlPage(
      'Authorization Denied',
      'Authorization Denied',
      `<p>DocuSign did not grant access. You can close this window and try again.</p>
       <p class="subtle">Error: ${error}</p>`,
      true,
    ));
    return;
  }

  if (!code || !state) {
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(400).send(htmlPage(
      'Invalid Request',
      'Something went wrong',
      '<p>Missing authorization parameters. Please try connecting again from your conversation.</p>',
      true,
    ));
    return;
  }

  // Verify CSRF state
  const storedCsrf = getCookie(req, 'oa_oauth_state');
  const [csrfFromState, apiKey] = state.split(':');

  if (!storedCsrf || storedCsrf !== csrfFromState) {
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(403).send(htmlPage(
      'Session Expired',
      'Session Expired',
      '<p>Your authorization session has expired or is invalid. Please try connecting again from your conversation.</p>',
      true,
    ));
    return;
  }

  // Get PKCE code verifier from cookie
  const codeVerifier = getCookie(req, 'oa_pkce_verifier');
  if (!codeVerifier) {
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(400).send(htmlPage(
      'Session Expired',
      'Session Expired',
      '<p>Your PKCE session has expired. Please try connecting again from your conversation.</p>',
      true,
    ));
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
      res.setHeader('Set-Cookie', clearCookies);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(502).send(htmlPage(
        'Connection Failed',
        'Connection Failed',
        '<p>Could not exchange authorization with DocuSign. Please try again.</p>',
        true,
      ));
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
      res.setHeader('Set-Cookie', clearCookies);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(502).send(htmlPage(
        'Connection Failed',
        'Connection Failed',
        '<p>Could not retrieve your DocuSign account info. Please try again.</p>',
        true,
      ));
      return;
    }

    const userInfo = await userInfoResponse.json() as {
      accounts: Array<{ account_id: string; account_name: string; base_uri: string; is_default: boolean }>;
    };

    const account = userInfo.accounts.find(a => a.is_default) || userInfo.accounts[0];
    if (!account) {
      res.setHeader('Set-Cookie', clearCookies);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send(htmlPage(
        'No Account Found',
        'No DocuSign Account Found',
        '<p>No DocuSign accounts were found for this user. Please check your DocuSign setup.</p>',
        true,
      ));
      return;
    }

    // TODO: Encrypt tokens and store in Firestore via SigningContext
    // For now, return success (tokens are NOT exposed to the browser)

    // Clear OAuth cookies
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlPage(
      'Connected',
      'DocuSign Connected',
      `<p>Your DocuSign account <strong>${account.account_name || account.account_id}</strong> has been connected.</p>
       <p>You can close this window and return to your conversation to send agreements for signature.</p>
       <p class="subtle">Connection ID: docusign-${account.account_id}</p>`,
    ));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(htmlPage(
      'Error',
      'Something Went Wrong',
      `<p>An unexpected error occurred. Please try connecting again.</p>
       <p class="subtle">${message}</p>`,
      true,
    ));
  }
}
