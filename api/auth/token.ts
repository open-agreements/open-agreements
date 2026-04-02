/**
 * OAuth Token Endpoint
 * POST /api/auth/token
 *
 * Exchanges an OA authorization code for a JWT access token + opaque refresh token.
 * Also handles refresh_token grant for silent re-auth.
 *
 * Required: grant_type, code (or refresh_token), code_verifier (for auth code), resource
 */

import type { HttpRequest, HttpResponse } from '../_http-types.js';
import { SignJWT } from 'jose';
import { randomBytes, createHash } from 'node:crypto';
import { getPrivateKey, getKid } from './_keys.js';

const OA_ORIGIN = process.env.OA_ORIGIN?.trim() || 'https://openagreements.org';
const MCP_RESOURCE = `${OA_ORIGIN}/api/mcp`;
const ACCESS_TOKEN_TTL = 3600; // 1 hour

let _db: FirebaseFirestore.Firestore | null = null;
async function getDb() {
  if (_db) return _db;
  const { Firestore } = await import('@google-cloud/firestore');
  _db = new Firestore({ projectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT });
  return _db;
}

function parseBody(req: HttpRequest): Record<string, string> {
  if (typeof req.body === 'string') {
    // URL-encoded form body
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  return req.body as Record<string, string>;
}

async function issueTokens(sub: string, scope: string, clientId: string, familyId?: string) {
  const privateKey = await getPrivateKey();
  const kid = await getKid();

  const accessToken = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(OA_ORIGIN)
    .setAudience(MCP_RESOURCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(privateKey);

  const refreshToken = randomBytes(48).toString('base64url');
  const refreshFamilyId = familyId || randomBytes(16).toString('hex');

  const db = await getDb();
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  await db.collection('oauth_refresh_tokens').doc(tokenHash).set({
    client_id: clientId,
    sub,
    resource: MCP_RESOURCE,
    family_id: refreshFamilyId,
    used: false,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope,
  };
}

async function handleAuthorizationCode(body: Record<string, string>, res: HttpResponse) {
  const { code, code_verifier, redirect_uri, resource } = body;

  if (!code || !code_verifier) {
    res.status(400).json({ error: 'invalid_request', error_description: 'code and code_verifier required' });
    return;
  }

  if (resource && resource !== MCP_RESOURCE) {
    res.status(400).json({ error: 'invalid_target', error_description: `Resource must be ${MCP_RESOURCE}` });
    return;
  }

  const db = await getDb();
  const codeDoc = await db.collection('oauth_codes').doc(code).get();

  if (!codeDoc.exists) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
    return;
  }

  const codeData = codeDoc.data()!;

  // Check expiry
  if (new Date(codeData.expires_at) < new Date()) {
    await codeDoc.ref.delete();
    res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    return;
  }

  // Check single-use
  if (codeData.used) {
    await codeDoc.ref.delete();
    res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
    return;
  }

  // Validate PKCE
  const expectedChallenge = createHash('sha256').update(code_verifier).digest('base64url');
  if (expectedChallenge !== codeData.code_challenge) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    return;
  }

  // Validate redirect_uri matches what was used during authorization
  if (redirect_uri && redirect_uri !== codeData.redirect_uri) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    return;
  }

  // Mark code as used
  await codeDoc.ref.update({ used: true });

  // sub is set by the DocuSign callback — it's the connectionId (e.g., docusign-{account_id})
  // For signing scope, sub MUST be set (means DocuSign auth completed successfully)
  const sub = codeData.sub;
  if (!sub && codeData.scope?.includes('signing')) {
    res.status(400).json({
      error: 'invalid_grant',
      error_description: 'DocuSign authorization not completed. The authorization code was not bound to a DocuSign account.',
    });
    return;
  }
  const tokens = await issueTokens(sub || codeData.client_id, codeData.scope, codeData.client_id);

  res.status(200).json(tokens);
}

async function handleRefreshToken(body: Record<string, string>, res: HttpResponse) {
  const { refresh_token, resource } = body;

  if (!refresh_token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token required' });
    return;
  }

  if (resource && resource !== MCP_RESOURCE) {
    res.status(400).json({ error: 'invalid_target', error_description: `Resource must be ${MCP_RESOURCE}` });
    return;
  }

  const db = await getDb();
  const tokenHash = createHash('sha256').update(refresh_token).digest('hex');
  const tokenDoc = await db.collection('oauth_refresh_tokens').doc(tokenHash).get();

  if (!tokenDoc.exists) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
    return;
  }

  const tokenData = tokenDoc.data()!;

  // Check expiry
  if (new Date(tokenData.expires_at) < new Date()) {
    await tokenDoc.ref.delete();
    res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired' });
    return;
  }

  // Reuse detection — if already used, revoke entire family
  if (tokenData.used) {
    console.warn(`Refresh token reuse detected! Family: ${tokenData.family_id}. Revoking all.`);
    const familyTokens = await db.collection('oauth_refresh_tokens')
      .where('family_id', '==', tokenData.family_id)
      .get();
    const batch = db.batch();
    familyTokens.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token reuse detected. All tokens revoked. Re-authenticate.' });
    return;
  }

  // Mark old token as used (don't delete — keep for reuse detection)
  await tokenDoc.ref.update({ used: true });

  // Issue new tokens in the same family
  const tokens = await issueTokens(tokenData.sub, 'signing', tokenData.client_id, tokenData.family_id);

  res.status(200).json(tokens);
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'invalid_request', error_description: 'POST only' });
    return;
  }

  try {
    const body = parseBody(req);
    const grantType = body.grant_type;

    if (grantType === 'authorization_code') {
      await handleAuthorizationCode(body, res);
    } else if (grantType === 'refresh_token') {
      await handleRefreshToken(body, res);
    } else {
      res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Supported: authorization_code, refresh_token' });
    }
  } catch (e) {
    console.error('Token endpoint error:', e);
    res.status(500).json({ error: 'server_error', error_description: (e as Error).message });
  }
}
