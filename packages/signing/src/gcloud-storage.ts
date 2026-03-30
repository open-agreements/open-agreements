/**
 * Google Cloud Firestore + Storage backend for the signing package.
 *
 * Provides concrete implementations of the storage callbacks that
 * the DocuSignProvider receives via config. Tokens are AES-256-GCM
 * encrypted before writing to Firestore.
 *
 * Collections:
 *   signing_connections — OAuth tokens + account info (encrypted)
 *   signing_envelopes   — envelope status + signer info
 *   signing_audit_log   — every action logged
 *
 * Bucket: openagreements-signing-artifacts
 */

import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from './storage.js';
import type { ConnectionRecord, EnvelopeStatus, DocumentRef } from './provider.js';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface GCloudStorageConfig {
  projectId: string;
  bucketName: string;
  /** 32-byte encryption key for AES-256-GCM token encryption. */
  encryptionKey: Buffer;
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create storage callbacks for the DocuSign adapter config.
 * Returns the callback functions that DocuSignProvider expects.
 */
export function createGCloudStorageCallbacks(config: GCloudStorageConfig) {
  const db = new Firestore({ projectId: config.projectId });
  const gcs = new Storage({ projectId: config.projectId });
  const bucket = gcs.bucket(config.bucketName);

  return {
    /** Store a connection record with encrypted tokens. */
    async storeConnection(record: ConnectionRecord & { accessToken: string; refreshToken: string }): Promise<void> {
      const docRef = db.collection('signing_connections').doc(record.connectionId);
      await docRef.set({
        connectionId: record.connectionId,
        provider: record.provider,
        accountId: record.accountId,
        baseUri: record.baseUri,
        scopes: record.scopes,
        expiresAt: record.expiresAt,
        apiKey: record.apiKey,
        encryptedAccessToken: encrypt(record.accessToken, config.encryptionKey),
        encryptedRefreshToken: encrypt(record.refreshToken, config.encryptionKey),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    /** Retrieve a connection record by API key. Returns null if not found. */
    async getConnection(apiKey: string): Promise<(ConnectionRecord & { accessToken: string; refreshToken: string }) | null> {
      const snapshot = await db.collection('signing_connections')
        .where('apiKey', '==', apiKey)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const data = snapshot.docs[0].data();
      return {
        connectionId: data.connectionId,
        provider: data.provider,
        accountId: data.accountId,
        baseUri: data.baseUri,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
        apiKey: data.apiKey,
        accessToken: decrypt(data.encryptedAccessToken, config.encryptionKey),
        refreshToken: decrypt(data.encryptedRefreshToken, config.encryptionKey),
      };
    },

    /** Remove a connection record. */
    async removeConnection(connectionId: string): Promise<void> {
      await db.collection('signing_connections').doc(connectionId).delete();
    },

    /** Upload a document to GCS and return the storage URL. */
    async storeDocument(buffer: Buffer, filename: string): Promise<string> {
      const path = `documents/${Date.now()}-${randomBytes(4).toString('hex')}/${filename}`;
      const file = bucket.file(path);
      await file.save(buffer, {
        contentType: filename.endsWith('.pdf')
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      return `gs://${config.bucketName}/${path}`;
    },

    /** Download a document from GCS by storage URL. */
    async getDocument(storageUrl: string): Promise<Buffer> {
      // Parse gs://bucket/path format
      const path = storageUrl.replace(`gs://${config.bucketName}/`, '');
      const file = bucket.file(path);
      const [content] = await file.download();
      return content;
    },

    /** Store envelope status in Firestore. */
    async storeEnvelopeStatus(envelopeId: string, status: EnvelopeStatus): Promise<void> {
      await db.collection('signing_envelopes').doc(envelopeId).set({
        ...status,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    },

    /** Get envelope status from Firestore. */
    async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus | null> {
      const doc = await db.collection('signing_envelopes').doc(envelopeId).get();
      if (!doc.exists) return null;
      const data = doc.data()!;
      return {
        envelopeId: data.envelopeId,
        status: data.status,
        signers: data.signers || [],
      };
    },

    /** Log an audit event. */
    async auditLog(event: { action: string; apiKey: string; envelopeId?: string; details?: Record<string, unknown> }): Promise<void> {
      await db.collection('signing_audit_log').add({
        ...event,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
