export type {
  DocumentRef,
  ArtifactRef,
  Signer,
  SigningMetadata,
  ConnectionRecord,
  DraftResult,
  EnvelopeStatusCode,
  SignerStatus,
  EnvelopeStatus,
  SigningProvider,
} from './provider.js';

export {
  SigningConfigSchema,
  SignerRoleSchema,
  ProviderAnchorsSchema,
  loadSigningConfig,
  getProviderAnchors,
  getSignatureTagFields,
} from './signing-config.js';

export type {
  SignerRole,
  SigningConfig,
} from './signing-config.js';

export { DocuSignProvider } from './docusign.js';
export type { DocuSignConfig } from './docusign.js';

export {
  encrypt,
  decrypt,
  createDocumentRef,
  createArtifactRef,
} from './storage.js';

export type {
  StoredConnection,
  AuditLogEntry,
  StoredEnvelopeStatus,
  GCSConfig,
} from './storage.js';

export { createGCloudStorageCallbacks } from './gcloud-storage.js';
export type { GCloudStorageConfig } from './gcloud-storage.js';

export { createSigningContext } from './context.js';
export type { SigningContext, SigningContextConfig } from './context.js';

// MCP tool definitions for signing (moved from contract-templates-mcp)
export { signingTools, setSigningContext, listSigningToolDescriptors, SigningError } from './mcp-tools.js';
export type { SigningErrorCode } from './mcp-tools.js';
