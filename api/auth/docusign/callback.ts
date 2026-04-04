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
import { DOCUSIGN_AUTH_BASE, INTEGRATION_KEY, SECRET_KEY, DS_REDIRECT_URI as REDIRECT_URI, getQuery } from '../../_config.js';
import { getDb } from '../_db.js';

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
  // Clear ALL OAuth cookies on every callback (both old and new flow names)
  const clearCookies = [
    // Old flow cookies
    'oa_pkce_verifier=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    // New MCP OAuth flow cookies
    'oa_ds_verifier=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_ds_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_auth_code=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_client_redirect=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'oa_client_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
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

  // Detect flow type from state format
  const [csrfFromState, flowKey] = state.split(':');
  const isMcpOAuth = flowKey === 'mcp-oauth';

  // Read correct cookies based on flow type
  const storedCsrf = isMcpOAuth ? getCookie(req, 'oa_ds_state') : getCookie(req, 'oa_oauth_state');
  const codeVerifier = isMcpOAuth ? getCookie(req, 'oa_ds_verifier') : getCookie(req, 'oa_pkce_verifier');
  const apiKey = isMcpOAuth ? undefined : flowKey; // old flow passes api_key in state

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
    // Exchange code for DocuSign tokens
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

    // Store encrypted connection in Firestore
    const connectionId = `docusign-${account.account_id}`;
    const encryptionKeyHex = process.env.OA_GCLOUD_ENCRYPTION_KEY?.trim();
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
    if (encryptionKeyHex) {
      const { createGCloudStorageCallbacks } = await import(
        '../../../packages/signing/src/gcloud-storage.js'
      );
      let credentials: { client_email: string; private_key: string; [key: string]: unknown } | undefined;
      if (credentialsJson) {
        try { credentials = JSON.parse(credentialsJson); } catch { /* ADC fallback */ }
      }
      const storage = createGCloudStorageCallbacks({
        projectId: process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'open-agreements',
        bucketName: 'openagreements-signing-artifacts',
        encryptionKey: Buffer.from(encryptionKeyHex, 'hex'),
        ...(credentials ? { credentials } : {}),
      });
      // For MCP OAuth, key by connectionId. For old flow, key by apiKey.
      const storageKey = isMcpOAuth ? connectionId : (apiKey || connectionId);
      await storage.storeConnection({
        connectionId,
        provider: 'docusign',
        accountId: account.account_id,
        baseUri: account.base_uri,
        scopes: ['signature', 'extended'],
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        apiKey: storageKey,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      await storage.auditLog({
        action: 'oauth_connect',
        apiKey: storageKey,
        details: { connectionId, accountId: account.account_id, provider: 'docusign', flow: isMcpOAuth ? 'mcp-oauth' : 'legacy' },
      });
    }

    // --- Flow-specific response ---

    if (isMcpOAuth) {
      // MCP OAuth flow: update OA auth code with sub, redirect to client
      const oaAuthCode = getCookie(req, 'oa_auth_code');
      const clientRedirect = getCookie(req, 'oa_client_redirect');
      const clientState = getCookie(req, 'oa_client_state');

      if (!oaAuthCode || !clientRedirect) {
        res.setHeader('Set-Cookie', clearCookies);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(400).send(htmlPage(
          'Session Error',
          'Session Error',
          '<p>Missing MCP OAuth session data. Please try connecting again.</p>',
          true,
        ));
        return;
      }

      // Update the OA auth code with the sub (connectionId)
      try {
        const db = await getDb();
        await db.collection('oauth_codes').doc(oaAuthCode).update({
          sub: connectionId,
        });
      } catch (e) {
        console.error('Failed to update OA auth code with sub:', e);
        // Non-fatal — token exchange will use client_id as fallback sub
      }

      // Redirect back to the MCP client with OA auth code
      const decodedRedirect = decodeURIComponent(clientRedirect);
      const decodedState = clientState ? decodeURIComponent(clientState) : '';
      const redirectUrl = new URL(decodedRedirect);
      redirectUrl.searchParams.set('code', oaAuthCode);
      if (decodedState) redirectUrl.searchParams.set('state', decodedState);

      res.setHeader('Set-Cookie', clearCookies);
      res.redirect(302, redirectUrl.toString());
      return;
    }

    // Old flow: show HTML confirmation page
    res.setHeader('Set-Cookie', clearCookies);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlPage(
      'Connected',
      'DocuSign Connected',
      `<p>Your DocuSign account <strong>${account.account_name || account.account_id}</strong> has been connected.</p>
       <p>You can close this window and return to your conversation to send agreements for signature.</p>
       <p class="subtle">Connection ID: ${connectionId}</p>`,
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
