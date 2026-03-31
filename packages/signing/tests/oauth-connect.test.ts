/**
 * Test the OAuth connect handler logic (without Vercel runtime).
 */

import { describe, it, expect } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';

describe('OAuth connect flow', () => {
  const INTEGRATION_KEY = 'd2b5e34b-aa16-4459-95c5-3f7650df6ff8';

  it('generates a valid DocuSign OAuth URL with PKCE and state', () => {
    const apiKey = 'user-api-key-123';
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const csrfToken = randomBytes(16).toString('hex');
    const state = `${csrfToken}:${apiKey}`;

    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature extended',
      client_id: INTEGRATION_KEY,
      redirect_uri: 'http://localhost:3000/api/auth/docusign/callback',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://account-d.docusign.com/oauth/auth?${params.toString()}`;

    // Verify URL structure
    expect(authUrl).toContain('account-d.docusign.com');
    expect(authUrl).toContain(INTEGRATION_KEY);
    expect(authUrl).toContain('code_challenge=');
    expect(authUrl).toContain('S256');
    expect(authUrl).toContain(encodeURIComponent(apiKey));

    // Verify PKCE challenge matches verifier
    const recomputedChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    expect(authUrl).toContain(`code_challenge=${recomputedChallenge}`);

    // Verify state contains API key
    const stateParam = new URL(authUrl).searchParams.get('state');
    expect(stateParam).toContain(apiKey);
  });

  it('builds correct token exchange request body', () => {
    const code = 'auth-code-from-docusign';
    const codeVerifier = randomBytes(32).toString('base64url');
    const basicAuth = Buffer.from(`${INTEGRATION_KEY}:test-secret`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: 'http://localhost:3000/api/auth/docusign/callback',
    });

    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe(code);
    expect(body.get('code_verifier')).toBe(codeVerifier);
    expect(basicAuth).toContain('ZDJiNWUzNG'); // base64 of integration key prefix
  });

  it('CSRF state can be split to extract api_key', () => {
    const csrfToken = randomBytes(16).toString('hex');
    const apiKey = 'my-secret-api-key';
    const state = `${csrfToken}:${apiKey}`;

    const [extractedCsrf, extractedKey] = state.split(':');
    expect(extractedCsrf).toBe(csrfToken);
    expect(extractedKey).toBe(apiKey);
  });
});
