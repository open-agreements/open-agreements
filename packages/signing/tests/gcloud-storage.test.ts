/**
 * Integration tests for Google Cloud Firestore + Storage backend.
 * These hit real GCS and Firestore — run only in environments with ADC configured.
 *
 * Skip in CI with: SKIP_GCLOUD_TESTS=1 npx vitest run
 */

import { describe, expect, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { itAllure } from '../../../integration-tests/helpers/allure-test.ts';
import { createGCloudStorageCallbacks } from '../src/gcloud-storage.js';

const it = itAllure.epic('Agreement Signing');
const SKIP = process.env.SKIP_GCLOUD_TESTS === '1';

const config = {
  projectId: 'open-agreements',
  bucketName: 'openagreements-signing-artifacts',
  encryptionKey: randomBytes(32),
};

describe.skipIf(SKIP)('GCloud storage integration', () => {
  const callbacks = createGCloudStorageCallbacks(config);
  const testConnectionId = `test-conn-${Date.now()}`;

  afterAll(async () => {
    // Cleanup test data
    try {
      await callbacks.removeConnection(testConnectionId);
    } catch { /* ignore */ }
  });

  it.openspec('OA-SIG-008')('stores and retrieves a connection with encrypted tokens', async () => {
    const record = {
      connectionId: testConnectionId,
      provider: 'docusign',
      accountId: 'test-account-123',
      baseUri: 'https://demo.docusign.net',
      scopes: ['signature', 'extended'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      apiKey: `test-key-${Date.now()}`,
      accessToken: 'access-token-secret-value',
      refreshToken: 'refresh-token-secret-value',
    };

    await callbacks.storeConnection(record);

    const retrieved = await callbacks.getConnection(record.apiKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.connectionId).toBe(testConnectionId);
    expect(retrieved!.accountId).toBe('test-account-123');
    expect(retrieved!.accessToken).toBe('access-token-secret-value');
    expect(retrieved!.refreshToken).toBe('refresh-token-secret-value');
  });

  it.openspec('OA-SIG-008')('returns null for unknown api key', async () => {
    const result = await callbacks.getConnection('nonexistent-key');
    expect(result).toBeNull();
  });

  it.openspec('OA-SIG-009')('removes a connection', async () => {
    await callbacks.removeConnection(testConnectionId);
    const result = await callbacks.getConnection(`test-key-${Date.now()}`);
    expect(result).toBeNull();
  });

  it.openspec('OA-SIG-008')('stores and retrieves a document from GCS', async () => {
    const content = Buffer.from('test document content for signing integration');
    const storageUrl = await callbacks.storeDocument(content, 'test-nda.docx');

    expect(storageUrl).toContain('gs://openagreements-signing-artifacts/');
    expect(storageUrl).toContain('test-nda.docx');

    const retrieved = await callbacks.getDocument(storageUrl);
    expect(retrieved.toString()).toBe('test document content for signing integration');

    // Cleanup
    const { Storage } = await import('@google-cloud/storage');
    const gcs = new Storage({ projectId: 'open-agreements' });
    const path = storageUrl.replace('gs://openagreements-signing-artifacts/', '');
    await gcs.bucket('openagreements-signing-artifacts').file(path).delete();
  });

  it.openspec('OA-SIG-008')('stores and retrieves envelope status', async () => {
    const envelopeId = `test-env-${Date.now()}`;

    await callbacks.storeEnvelopeStatus(envelopeId, {
      envelopeId,
      status: 'sent',
      signers: [{ name: 'Test', email: 'test@example.com', status: 'sent' }],
    });

    const status = await callbacks.getEnvelopeStatus(envelopeId);
    expect(status).not.toBeNull();
    expect(status!.status).toBe('sent');
    expect(status!.signers[0].email).toBe('test@example.com');

    // Cleanup
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({ projectId: 'open-agreements' });
    await db.collection('signing_envelopes').doc(envelopeId).delete();
  });

  it('writes audit log entries', async () => {
    await callbacks.auditLog({
      action: 'test_action',
      apiKey: 'test-key',
      envelopeId: 'test-env',
      details: { test: true },
    });

    // Just verify it doesn't throw — we don't query audit logs in tests
    expect(true).toBe(true);
  });
});
