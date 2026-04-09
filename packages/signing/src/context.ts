/**
 * Signing context — shared runtime state for the signing integration.
 *
 * Initialized once at MCP server startup with credentials from env/keyvault.
 * Provides the DocuSign adapter pre-configured with GCloud storage callbacks.
 */

import { DocuSignProvider, type DocuSignConfig } from './docusign.js';
import { createGCloudStorageCallbacks, type GCloudStorageConfig } from './gcloud-storage.js';
import type { ConnectionRecord, DocumentRef, EnvelopeStatus } from './provider.js';
import { createDocumentRef } from './storage.js';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

export interface SigningContextConfig {
  docusign: {
    integrationKey: string;
    secretKey: string;
    redirectUri: string;
    hmacSecret?: string;
    sandbox?: boolean;
  };
  gcloud: GCloudStorageConfig;
}

export interface SigningContext {
  provider: DocuSignProvider;
  storage: ReturnType<typeof createGCloudStorageCallbacks>;

  /** Get the connection for a given API key, with decrypted tokens. */
  getConnectionForKey(apiKey: string): Promise<{
    connection: ConnectionRecord;
    accessToken: string;
  } | null>;

  /** Upload a local DOCX file to GCS and return a DocumentRef. */
  uploadLocalDocument(filePath: string): Promise<DocumentRef>;
}

/**
 * Create a signing context from configuration.
 * Call this once at MCP server startup.
 */
export function createSigningContext(config: SigningContextConfig): SigningContext {
  const storage = createGCloudStorageCallbacks(config.gcloud);

  const providerConfig: DocuSignConfig = {
    ...config.docusign,
    storeConnection: storage.storeConnection as unknown as DocuSignConfig['storeConnection'],
    getConnection: storage.getConnection as unknown as DocuSignConfig['getConnection'],
    removeConnection: storage.removeConnection,
    storeDocument: storage.storeDocument,
    getDocument: storage.getDocument,
    storeEnvelopeStatus: storage.storeEnvelopeStatus,
    auditLog: storage.auditLog,
  };

  const provider = new DocuSignProvider(providerConfig);

  return {
    provider,
    storage,

    async getConnectionForKey(apiKey: string) {
      const conn = await storage.getConnection(apiKey);
      if (!conn) return null;
      return {
        connection: conn,
        accessToken: conn.accessToken,
      };
    },

    async uploadLocalDocument(filePath: string): Promise<DocumentRef> {
      const buffer = readFileSync(filePath);
      const filename = basename(filePath) || 'document.docx';
      const ref = createDocumentRef(buffer, filename, 'uploaded');
      const storageUrl = await storage.storeDocument(buffer, filename);
      return { ...ref, storageUrl };
    },
  };
}
