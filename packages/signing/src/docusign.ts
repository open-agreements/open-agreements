/**
 * DocuSign eSignature adapter.
 *
 * Implements the SigningProvider interface for DocuSign's REST API v2.1.
 * Uses OAuth 2.0 Authorization Code Grant with PKCE.
 * Users authenticate with their own DocuSign accounts.
 *
 * Official docs:
 *   Auth:      https://developers.docusign.com/platform/auth/authcode/
 *   Envelopes: https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/
 *   AutoPlace: https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/tabs/auto-place/
 *   Sender:    https://developers.docusign.com/docs/esign-rest-api/reference/envelopes/envelopeviews/createsender/
 *   HMAC:      https://www.docusign.com/blog/developers/event-notifications-using-json-sim-and-hmac
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';
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
  integrationKey: string;
  secretKey: string;
  redirectUri: string;
  hmacSecret?: string;
  sandbox?: boolean;

  // Storage callbacks
  storeConnection: (record: ConnectionRecord) => Promise<void>;
  getConnection: (apiKey: string) => Promise<ConnectionRecord | null>;
  removeConnection: (connectionId: string) => Promise<void>;
  storeDocument: (buffer: Buffer, filename: string) => Promise<string>;
  getDocument: (storageUrl: string) => Promise<Buffer>;
  storeEnvelopeStatus: (envelopeId: string, status: EnvelopeStatus) => Promise<void>;
  auditLog: (event: { action: string; apiKey: string; envelopeId?: string; details?: Record<string, unknown> }) => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function authBaseUrl(sandbox: boolean): string {
  return sandbox ? 'https://account-d.docusign.com' : 'https://account.docusign.com';
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function computeCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
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

  /**
   * Generate OAuth authorization URL with PKCE.
   * Returns { url, codeVerifier } — caller must store codeVerifier for handleCallback.
   */
  getAuthUrl(redirectUri: string, state: string): string {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = computeCodeChallenge(codeVerifier);
    const base = authBaseUrl(this.sandbox);

    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature extended',
      client_id: this.config.integrationKey,
      redirect_uri: redirectUri || this.config.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Append code_verifier as a hint for the caller to extract and store
    return `${base}/oauth/auth?${params.toString()}&_code_verifier=${codeVerifier}`;
  }

  async handleCallback(
    code: string,
    codeVerifier: string,
  ): Promise<ConnectionRecord> {
    const base = authBaseUrl(this.sandbox);
    const basicAuth = Buffer.from(`${this.config.integrationKey}:${this.config.secretKey}`).toString('base64');

    // Exchange code for tokens
    const tokenResponse = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
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

    const account = userInfo.accounts.find(a => a.is_default) || userInfo.accounts[0];
    if (!account) throw new Error('No DocuSign accounts found');

    return {
      connectionId: `docusign-${account.account_id}`,
      provider: 'docusign',
      accountId: account.account_id,
      baseUri: account.base_uri,
      scopes: ['signature', 'extended'],
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      apiKey: '', // set by caller
    };
  }

  async disconnect(connectionId: string): Promise<void> {
    await this.config.removeConnection(connectionId);
  }

  // ── Envelope Lifecycle ─────────────────────────────────────────────────

  /**
   * Create a draft envelope with anchor-based tab placement.
   * Always creates in "created" status (never auto-sends).
   *
   * POST /v2.1/accounts/{accountId}/envelopes
   */
  async createDraft(
    documentRef: DocumentRef,
    metadata: SigningMetadata,
    connection?: ConnectionRecord,
    accessToken?: string,
  ): Promise<DraftResult> {
    if (!connection || !accessToken) {
      throw new Error('Connection and access token required for createDraft');
    }

    const docBuffer = await this.config.getDocument(documentRef.storageUrl);
    const base64Doc = docBuffer.toString('base64');

    // Build signers with anchor-based tabs
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

    const envelopeBody = {
      emailSubject: metadata.emailSubject,
      emailBlurb: metadata.emailBody || '',
      status: 'created',
      documents: [{
        documentId: '1',
        name: documentRef.filename,
        fileExtension: documentRef.mimeType.includes('pdf') ? 'pdf' : 'docx',
        documentBase64: base64Doc,
      }],
      recipients: {
        signers,
        ...(ccRecipients.length > 0 ? { carbonCopies: ccRecipients } : {}),
      },
    };

    const apiUrl = `${connection.baseUri}/restapi/v2.1/accounts/${connection.accountId}/envelopes`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeBody),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DocuSign create envelope failed: ${response.status} ${err}`);
    }

    const envelope = await response.json() as {
      envelopeId: string;
      status: string;
      uri: string;
    };

    // Get embedded sender view URL
    const senderViewUrl = `${connection.baseUri}/restapi/v2.1/accounts/${connection.accountId}/envelopes/${envelope.envelopeId}/views/sender`;

    const senderResponse = await fetch(senderViewUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        returnUrl: `${this.config.redirectUri.replace('/callback', '/sent')}?envelopeId=${envelope.envelopeId}`,
        viewAccess: 'envelope',
      }),
    });

    let reviewUrl = '';
    if (senderResponse.ok) {
      const senderView = await senderResponse.json() as { url: string };
      reviewUrl = senderView.url;
    }

    // Audit log
    await this.config.auditLog({
      action: 'envelope_created',
      apiKey: connection.apiKey,
      envelopeId: envelope.envelopeId,
      details: {
        signers: metadata.signers.map(s => ({ name: s.name, email: s.email })),
        emailSubject: metadata.emailSubject,
      },
    });

    return {
      draftId: envelope.envelopeId,
      reviewUrl,
      providerEnvelopeId: envelope.envelopeId,
      documentRef,
      status: 'created',
    };
  }

  /**
   * Transition a draft envelope to sent.
   *
   * PUT /v2.1/accounts/{accountId}/envelopes/{envelopeId}
   */
  async send(
    draftId: string,
    connection?: ConnectionRecord,
    accessToken?: string,
  ): Promise<{ envelopeId: string; status: 'sent' }> {
    if (!connection || !accessToken) {
      throw new Error('Connection and access token required for send');
    }

    const apiUrl = `${connection.baseUri}/restapi/v2.1/accounts/${connection.accountId}/envelopes/${draftId}`;

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'sent' }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DocuSign send failed: ${response.status} ${err}`);
    }

    return { envelopeId: draftId, status: 'sent' };
  }

  /**
   * Get envelope and signer statuses.
   *
   * GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}
   */
  async getStatus(
    envelopeId: string,
    connection?: ConnectionRecord,
    accessToken?: string,
  ): Promise<EnvelopeStatus> {
    if (!connection || !accessToken) {
      throw new Error('Connection and access token required for getStatus');
    }

    const apiUrl = `${connection.baseUri}/restapi/v2.1/accounts/${connection.accountId}/envelopes/${envelopeId}`;

    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DocuSign getStatus failed: ${response.status} ${err}`);
    }

    const env = await response.json() as {
      envelopeId: string;
      status: string;
      recipients?: {
        signers?: Array<{
          name: string;
          email: string;
          status: string;
          signedDateTime?: string;
        }>;
      };
    };

    const statusMap: Record<string, EnvelopeStatusCode> = {
      created: 'created',
      sent: 'sent',
      delivered: 'delivered',
      completed: 'completed',
      declined: 'declined',
      voided: 'voided',
    };

    // Fetch recipients if not included
    let signerStatuses = env.recipients?.signers || [];
    if (signerStatuses.length === 0) {
      const recipUrl = `${apiUrl}/recipients`;
      const recipResponse = await fetch(recipUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (recipResponse.ok) {
        const recips = await recipResponse.json() as {
          signers?: Array<{
            name: string;
            email: string;
            status: string;
            signedDateTime?: string;
          }>;
        };
        signerStatuses = recips.signers || [];
      }
    }

    return {
      envelopeId: env.envelopeId,
      status: statusMap[env.status] || 'created',
      signers: signerStatuses.map(s => ({
        name: s.name,
        email: s.email,
        status: s.status,
        signedAt: s.signedDateTime,
      })),
    };
  }

  /**
   * Download signed PDF, store in GCS, return presigned URL.
   *
   * GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}/documents/combined
   */
  async fetchArtifact(
    envelopeId: string,
    connection?: ConnectionRecord,
    accessToken?: string,
  ): Promise<ArtifactRef> {
    if (!connection || !accessToken) {
      throw new Error('Connection and access token required for fetchArtifact');
    }

    const apiUrl = `${connection.baseUri}/restapi/v2.1/accounts/${connection.accountId}/envelopes/${envelopeId}/documents/combined?certificate=true`;

    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DocuSign fetchArtifact failed: ${response.status} ${err}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    const storageUrl = await this.config.storeDocument(pdfBuffer, `signed-${envelopeId}.pdf`);

    return {
      id: `artifact-${envelopeId}`,
      downloadUrl: storageUrl,
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
