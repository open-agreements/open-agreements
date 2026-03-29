/**
 * Provider-neutral signing adapter interface.
 *
 * Signature fields use the same {tag} mechanism as fill fields in docx-templates.
 * The DOCX template has tags like {sig_party_1} next to signature blocks.
 * At fill time, the pipeline populates these with the provider's anchor string
 * (e.g., DocuSign's "/sn1/" or Dropbox Sign's "[sig|req|signer1]").
 * The AI never touches signature tags — they're reserved for the signing adapter.
 *
 * Official anchor syntax (verified against provider docs):
 *   DocuSign:     /sn1/                             (does NOT strip — tab overlays)
 *   Dropbox Sign: [sig|req|signer1|label|id]         (strips, warns on non-PDF)
 *   Adobe Sign:   {{name_es_:signer1:signature}}      (strips)
 *   PandaDoc:     {{signature:role}}                  (strips)
 */

// ─── Document & Artifact References ─────────────────────────────────────────

/** Reference to a stored document (never raw bytes over the wire). */
export interface DocumentRef {
  id: string;
  sha256: string;
  filename: string;
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'application/pdf';
  storageUrl: string;
  source: 'generated' | 'uploaded';
}

/** Reference to a signed artifact (presigned download URL). */
export interface ArtifactRef {
  id: string;
  downloadUrl: string;
  expiresAt: string;
}

// ─── Signers & Metadata ─────────────────────────────────────────────────────

export interface Signer {
  name: string;
  email: string;
  role: string;
  type: 'signer' | 'cc';
  routingOrder?: number;
}

export interface SigningMetadata {
  signers: Signer[];
  emailSubject: string;
  emailBody?: string;
}

// ─── Connection & Status ────────────────────────────────────────────────────

export interface ConnectionRecord {
  connectionId: string;
  provider: string;
  accountId: string;
  baseUri: string;
  scopes: string[];
  expiresAt: string;
  apiKey: string;
}

export interface DraftResult {
  draftId: string;
  reviewUrl: string;
  providerEnvelopeId: string;
  documentRef: DocumentRef;
  status: 'created';
}

export type EnvelopeStatusCode =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'signed'
  | 'completed'
  | 'declined'
  | 'voided';

export interface SignerStatus {
  name: string;
  email: string;
  status: string;
  signedAt?: string;
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: EnvelopeStatusCode;
  signers: SignerStatus[];
}

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface SigningProvider {
  /** Provider identifier: 'docusign' | 'dropboxsign' | 'adobesign' | 'pandadoc' */
  readonly name: string;

  // ── OAuth ──

  /** Generate authorization URL with PKCE and CSRF state. */
  getAuthUrl(redirectUri: string, state: string): string;

  /** Exchange authorization code for tokens; persist connection record. */
  handleCallback(
    code: string,
    codeVerifier: string,
  ): Promise<ConnectionRecord>;

  /** Revoke tokens and remove connection record. */
  disconnect(connectionId: string): Promise<void>;

  // ── Envelope Lifecycle ──

  /** Upload document and create a draft envelope. Returns sender-view URL. */
  createDraft(
    documentRef: DocumentRef,
    metadata: SigningMetadata,
  ): Promise<DraftResult>;

  /** Transition a draft envelope to sent. */
  send(
    draftId: string,
  ): Promise<{ envelopeId: string; status: 'sent' }>;

  /** Get current envelope and signer statuses. */
  getStatus(envelopeId: string): Promise<EnvelopeStatus>;

  /** Retrieve signed document as a presigned download URL (never raw bytes). */
  fetchArtifact(envelopeId: string): Promise<ArtifactRef>;

  // ── Webhooks ──

  /** Verify webhook payload HMAC signature. */
  verifyWebhook(
    headers: Record<string, string>,
    body: string,
  ): boolean;

  /** Process a verified webhook event and return updated status. */
  handleWebhookEvent(event: unknown): Promise<EnvelopeStatus>;
}
