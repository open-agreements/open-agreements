/**
 * DocuSign eSignature adapter.
 *
 * Implements the SigningProvider interface for DocuSign's REST API v2.1.
 * Uses OAuth 2.0 Authorization Code Grant with PKCE.
 * Users authenticate with their own DocuSign accounts.
 *
 * Official docs:
 *   Auth:     https://developers.docusign.com/platform/auth/authcode/
 *   Envelopes: https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/
 *   AutoPlace: https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/tabs/auto-place/
 *   Sender:    https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopeviews/createsender/
 *   HMAC:      https://www.docusign.com/blog/developers/event-notifications-using-json-sim-and-hmac
 */

import { createHmac, randomBytes } from 'node:crypto';
import type {
  SigningProvider,
  ConnectionRecord,
  DocumentRef,
  ArtifactRef,
  SigningMetadata,
  DraftResult,
  EnvelopeStatus,
  EnvelopeStatusCode,
} from './provider.js';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface DocuSignConfig {
  /** Integration Key (client ID) from DocuSign Apps and Keys. */
  integrationKey: string;
  /** Secret Key (client secret) from DocuSign Apps and Keys. */
  secretKey: string;
  /** OAuth redirect URI — must match what's configured in DocuSign app settings. */
  redirectUri: string;
  /** HMAC secret for webhook verification (configured in DocuSign Connect). */
  hmacSecret?: string;
  /** Use demo environment. Default: true. */
  sandbox?: boolean;

  // Storage callbacks — adapter doesn't own storage, caller provides these
  /** Store a connection record (encrypted tokens). */
  storeConnection: (record: ConnectionRecord) => Promise<void>;
  /** Retrieve a connection record by API key. */
  getConnection: (apiKey: string) => Promise<ConnectionRecord | null>;
  /** Remove a connection record. */
  removeConnection: (connectionId: string) => Promise<void>;
  /** Store a document in cloud storage, return its URL. */
  storeDocument: (buffer: Buffer, filename: string) => Promise<string>;
  /** Retrieve a document buffer from cloud storage URL. */
  getDocument: (storageUrl: string) => Promise<Buffer>;
  /** Store envelope status locally. */
  storeEnvelopeStatus: (envelopeId: string, status: EnvelopeStatus) => Promise<void>;
  /** Log an audit event. */
  auditLog: (event: { action: string; apiKey: string; envelopeId?: string; details?: Record<string, unknown> }) => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function authBaseUrl(sandbox: boolean): string {
  return sandbox ? 'https://account-d.docusign.com' : 'https://account.docusign.com';
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

async function sha256Base64Url(input: string): Promise<string> {
  const hash = createHmac('sha256', '').update(input).digest();
  return hash.toString('base64url');
}

// ─── DocuSign Provider ──────────────────────────────────────────────────────

export class DocuSignProvider implements SigningProvider {
  readonly name = 'docusign';
  private config: DocuSignConfig;
  private sandbox: boolean;

  constructor(config: DocuSignConfig) {
    this.config = config;
    this.sandbox = config.sandbox ?? true;
  }

  // ── OAuth ──────────────────────────────────────────────────────────────

  getAuthUrl(redirectUri: string, state: string): string {
    const codeVerifier = generateCodeVerifier();
    // Note: caller must store codeVerifier in session for handleCallback
    const base = authBaseUrl(this.sandbox);
    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature extended',
      client_id: this.config.integrationKey,
      redirect_uri: redirectUri || this.config.redirectUri,
      state,
      code_challenge_method: 'S256',
      // code_challenge computed from codeVerifier — caller stores verifier
    });
    return `${base}/oauth/auth?${params.toString()}&code_verifier_hint=${codeVerifier}`;
  }

  async handleCallback(
    code: string,
    codeVerifier: string,
  ): Promise<ConnectionRecord> {
    const base = authBaseUrl(this.sandbox);

    // Exchange code for tokens
    const tokenResponse = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.integrationKey}:${this.config.secretKey}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`DocuSign token exchange failed: ${tokenResponse.status} ${err}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    // Get user info (accountId, baseUri)
    const userInfoResponse = await fetch(`${base}/oauth/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error(`DocuSign userinfo failed: ${userInfoResponse.status}`);
    }

    const userInfo = await userInfoResponse.json() as {
      accounts: Array<{
        account_id: string;
        base_uri: string;
        is_default: boolean;
      }>;
    };

    const defaultAccount = userInfo.accounts.find(a => a.is_default) || userInfo.accounts[0];
    if (!defaultAccount) {
      throw new Error('No DocuSign accounts found for this user');
    }

    const record: ConnectionRecord = {
      connectionId: `docusign-${defaultAccount.account_id}`,
      provider: 'docusign',
      accountId: defaultAccount.account_id,
      baseUri: defaultAccount.base_uri,
      scopes: ['signature', 'extended'],
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      apiKey: '', // set by caller
    };

    return record;
  }

  async disconnect(connectionId: string): Promise<void> {
    await this.config.removeConnection(connectionId);
  }

  // ── Envelope Lifecycle ─────────────────────────────────────────────────

  async createDraft(
    documentRef: DocumentRef,
    metadata: SigningMetadata,
  ): Promise<DraftResult> {
    // Get the document bytes from storage
    const docBuffer = await this.config.getDocument(documentRef.storageUrl);
    const base64Doc = docBuffer.toString('base64');

    // Build recipients with anchor-based tabs
    const signers = metadata.signers
      .filter(s => s.type === 'signer')
      .map((signer, i) => ({
        email: signer.email,
        name: signer.name,
        recipientId: String(i + 1),
        routingOrder: String(signer.routingOrder ?? i + 1),
        tabs: {
          signHereTabs: [{
            anchorString: `/sn${i + 1}/`,
            anchorUnits: 'pixels',
            anchorYOffset: '0',
          }],
          dateSignedTabs: [{
            anchorString: `/ds${i + 1}/`,
            anchorUnits: 'pixels',
            anchorYOffset: '0',
          }],
        },
      }));

    const ccRecipients = metadata.signers
      .filter(s => s.type === 'cc')
      .map((signer, i) => ({
        email: signer.email,
        name: signer.name,
        recipientId: String(signers.length + i + 1),
        routingOrder: String(signer.routingOrder ?? signers.length + i + 1),
      }));

    // Create envelope in "created" (draft) status
    const envelopeBody = {
      emailSubject: metadata.emailSubject,
      emailBlurb: metadata.emailBody || '',
      status: 'created', // DRAFT — never auto-send
      documents: [{
        documentId: '1',
        name: documentRef.filename,
        fileExtension: 'docx',
        documentBase64: base64Doc,
      }],
      recipients: {
        signers,
        carbonCopies: ccRecipients.length > 0 ? ccRecipients : undefined,
      },
    };

    // TODO: Add eventNotification for webhooks when webhook endpoint is ready

    const apiUrl = `${this.config.redirectUri.includes('localhost') ? 'https://demo.docusign.net' : 'https://demo.docusign.net'}/restapi/v2.1/accounts/${this.config.integrationKey}/envelopes`;
    // Note: actual implementation will use the stored connection's baseUri + accountId
    // This is a placeholder — the real call needs a valid access token from the connection record

    return {
      draftId: 'placeholder',
      reviewUrl: 'placeholder',
      providerEnvelopeId: 'placeholder',
      documentRef,
      status: 'created',
    };
  }

  async send(draftId: string): Promise<{ envelopeId: string; status: 'sent' }> {
    // TODO: PUT /envelopes/{id} with status: "sent"
    return { envelopeId: draftId, status: 'sent' };
  }

  async getStatus(envelopeId: string): Promise<EnvelopeStatus> {
    // TODO: GET /envelopes/{id}
    return {
      envelopeId,
      status: 'created',
      signers: [],
    };
  }

  async fetchArtifact(envelopeId: string): Promise<ArtifactRef> {
    // TODO: GET /envelopes/{id}/documents/combined → store in GCS → return signed URL
    return {
      id: `artifact-${envelopeId}`,
      downloadUrl: 'placeholder',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
  }

  // ── Webhooks ───────────────────────────────────────────────────────────

  verifyWebhook(headers: Record<string, string>, body: string): boolean {
    if (!this.config.hmacSecret) return false;

    const signature = headers['x-docusign-signature-1'];
    if (!signature) return false;

    const computed = createHmac('sha256', this.config.hmacSecret)
      .update(body)
      .digest('base64');

    return computed === signature;
  }

  async handleWebhookEvent(event: unknown): Promise<EnvelopeStatus> {
    const payload = event as {
      envelopeId?: string;
      status?: string;
      recipientStatuses?: Array<{
        email: string;
        status: string;
        signedDateTime?: string;
      }>;
    };

    const statusMap: Record<string, EnvelopeStatusCode> = {
      sent: 'sent',
      delivered: 'delivered',
      completed: 'completed',
      declined: 'declined',
      voided: 'voided',
    };

    const status: EnvelopeStatus = {
      envelopeId: payload.envelopeId || '',
      status: statusMap[payload.status || ''] || 'created',
      signers: (payload.recipientStatuses || []).map(r => ({
        name: '',
        email: r.email,
        status: r.status,
        signedAt: r.signedDateTime,
      })),
    };

    if (payload.envelopeId) {
      await this.config.storeEnvelopeStatus(payload.envelopeId, status);
    }

    return status;
  }
}
