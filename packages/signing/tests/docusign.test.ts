import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { DocuSignProvider } from '../src/docusign.js';
import type { DocuSignConfig } from '../src/docusign.js';

// ── Minimal config for testing (no real API calls) ──────────────────────────

const testConfig: DocuSignConfig = {
  integrationKey: 'test-integration-key',
  secretKey: 'test-secret-key',
  redirectUri: 'http://localhost:3000/api/auth/docusign/callback',
  hmacSecret: 'test-hmac-secret-12345',
  sandbox: true,
  storeConnection: async () => {},
  getConnection: async () => null,
  removeConnection: async () => {},
  storeDocument: async () => 'https://storage.example.com/doc.docx',
  getDocument: async () => Buffer.from('test'),
  storeEnvelopeStatus: async () => {},
  auditLog: async () => {},
};

// ── OA-SIG-007: OAuth URL generation ────────────────────────────────────────

describe('DocuSign OAuth', () => {
  it('OA-SIG-007: getAuthUrl generates valid URL with PKCE params', () => {
    const provider = new DocuSignProvider(testConfig);
    const url = provider.getAuthUrl(testConfig.redirectUri, 'test-state-123');

    expect(url).toContain('https://account-d.docusign.com/oauth/auth');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=signature+extended');
    expect(url).toContain(`client_id=${testConfig.integrationKey}`);
    expect(url).toContain('state=test-state-123');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain(encodeURIComponent(testConfig.redirectUri));
  });

  it('OA-SIG-007: uses demo auth URL for sandbox', () => {
    const provider = new DocuSignProvider({ ...testConfig, sandbox: true });
    const url = provider.getAuthUrl(testConfig.redirectUri, 'state');
    expect(url).toContain('account-d.docusign.com');
  });

  it('OA-SIG-007: uses production auth URL when not sandbox', () => {
    const provider = new DocuSignProvider({ ...testConfig, sandbox: false });
    const url = provider.getAuthUrl(testConfig.redirectUri, 'state');
    expect(url).toContain('account.docusign.com');
    expect(url).not.toContain('account-d.docusign.com');
  });
});

// ── OA-SIG-014/015: Webhook HMAC verification ──────────────────────────────

describe('DocuSign webhook verification', () => {
  it('OA-SIG-014: verifyWebhook validates correct HMAC-SHA256 signature', () => {
    const provider = new DocuSignProvider(testConfig);
    const body = '{"envelopeId":"env-123","status":"completed"}';

    // Compute the expected HMAC
    const expectedSignature = createHmac('sha256', testConfig.hmacSecret!)
      .update(body)
      .digest('base64');

    const result = provider.verifyWebhook(
      { 'x-docusign-signature-1': expectedSignature },
      body,
    );
    expect(result).toBe(true);
  });

  it('OA-SIG-015: verifyWebhook rejects tampered payloads', () => {
    const provider = new DocuSignProvider(testConfig);
    const body = '{"envelopeId":"env-123","status":"completed"}';

    const result = provider.verifyWebhook(
      { 'x-docusign-signature-1': 'invalid-signature' },
      body,
    );
    expect(result).toBe(false);
  });

  it('OA-SIG-015: verifyWebhook rejects missing signature header', () => {
    const provider = new DocuSignProvider(testConfig);
    const result = provider.verifyWebhook({}, 'body');
    expect(result).toBe(false);
  });

  it('OA-SIG-015: verifyWebhook returns false when no HMAC secret configured', () => {
    const provider = new DocuSignProvider({ ...testConfig, hmacSecret: undefined });
    const result = provider.verifyWebhook(
      { 'x-docusign-signature-1': 'some-sig' },
      'body',
    );
    expect(result).toBe(false);
  });
});

// ── OA-SIG-016: Webhook event handling ──────────────────────────────────────

describe('DocuSign webhook event handling', () => {
  it('OA-SIG-016: handleWebhookEvent updates status on envelope-completed', async () => {
    let storedStatus: any = null;
    const provider = new DocuSignProvider({
      ...testConfig,
      storeEnvelopeStatus: async (id, status) => { storedStatus = { id, status }; },
    });

    const event = {
      envelopeId: 'env-456',
      status: 'completed',
      recipientStatuses: [
        { email: 'signer@example.com', status: 'completed', signedDateTime: '2026-03-29T15:00:00Z' },
      ],
    };

    const result = await provider.handleWebhookEvent(event);

    expect(result.envelopeId).toBe('env-456');
    expect(result.status).toBe('completed');
    expect(result.signers).toHaveLength(1);
    expect(result.signers[0].email).toBe('signer@example.com');
    expect(result.signers[0].signedAt).toBe('2026-03-29T15:00:00Z');

    // Verify it was stored
    expect(storedStatus).not.toBeNull();
    expect(storedStatus.id).toBe('env-456');
  });

  it('OA-SIG-017: createDraft requires connection and access token', async () => {
    const provider = new DocuSignProvider(testConfig);

    // Without connection/token, createDraft should throw
    await expect(provider.createDraft(
      {
        id: 'doc-123',
        sha256: 'abc',
        filename: 'test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        storageUrl: 'https://storage.example.com/test.docx',
        source: 'generated',
      },
      {
        signers: [{ name: 'Test', email: 'test@example.com', role: 'party_1', type: 'signer' }],
        emailSubject: 'Test NDA',
      },
    )).rejects.toThrow('Connection and access token required');
  });
});
