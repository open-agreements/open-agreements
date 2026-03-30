/**
 * Google Cloud Storage + Firestore helpers for the signing package.
 *
 * - GCS: stores filled DOCX files and signed PDFs with signed URLs
 * - Firestore: stores OAuth connection records (encrypted) and audit logs
 *
 * These are the concrete implementations of the storage callbacks
 * that the DocuSignProvider (and future providers) receive via config.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { DocumentRef, ArtifactRef, ConnectionRecord, EnvelopeStatus } from './provider.js';

// ─── GCS Helpers ────────────────────────────────────────────────────────────

export interface GCSConfig {
  bucketName: string;
  projectId: string;
}

/**
 * Store a document buffer in GCS and return a DocumentRef.
 */
export function createDocumentRef(
  buffer: Buffer,
  filename: string,
  source: 'generated' | 'uploaded',
): DocumentRef {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const id = `${sha256.substring(0, 12)}-${Date.now()}`;

  return {
    id,
    sha256,
    filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    storageUrl: '', // Set after upload
    source,
  };
}

/**
 * Generate a signed URL for downloading an artifact.
 * In production, this would use GCS signed URLs.
 * For now, returns a placeholder structure.
 */
export function createArtifactRef(
  storageUrl: string,
  expiresInMs: number = 3600000,
): ArtifactRef {
  return {
    id: `artifact-${Date.now()}`,
    downloadUrl: storageUrl, // In production: GCS signed URL
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

// ─── Encryption Helpers ─────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns base64-encoded ciphertext with IV and auth tag prepended.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value encrypted with encrypt().
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf-8');
}

// ─── Firestore Document Shapes ──────────────────────────────────────────────

/** Shape of a connection record as stored in Firestore (tokens encrypted). */
export interface StoredConnection {
  connectionId: string;
  provider: string;
  accountId: string;
  baseUri: string;
  scopes: string[];
  expiresAt: string;
  apiKey: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape of an audit log entry in Firestore. */
export interface AuditLogEntry {
  action: string;
  apiKey: string;
  envelopeId?: string;
  provider?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/** Shape of an envelope status record in Firestore. */
export interface StoredEnvelopeStatus {
  envelopeId: string;
  status: string;
  signers: Array<{
    name: string;
    email: string;
    status: string;
    signedAt?: string;
  }>;
  apiKey: string;
  provider: string;
  documentRef?: DocumentRef;
  createdAt: string;
  updatedAt: string;
}
