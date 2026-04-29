/**
 * MCP tools for agreement signing integration.
 *
 * 4 tools: connect, disconnect, send_for_signature, check_signature_status.
 *
 * These tools use a SigningContext (initialized at server startup) to
 * call the DocuSign adapter with real GCloud storage. If no context
 * is available (e.g., credentials not configured), tools throw
 * SigningError with a discriminated code so the MCP layer can map
 * them to v2 envelope error codes.
 *
 * IMPORTANT: Tools return raw business data (Record<string, unknown>),
 * NOT pre-formatted ToolCallResult. The MCP layer (api/mcp.ts) is
 * responsible for wrapping responses in the v2 envelope contract.
 */

import { z } from 'zod';
import { basename } from 'node:path';
import { existsSync, statSync } from 'node:fs';

// ─── Signing Domain Error ───────────────────────────────────────────────────

/** Signing domain error codes for v2 envelope mapping. */
export type SigningErrorCode =
  | 'NO_SIGNING_PROVIDER'
  | 'INVALID_DOCUMENT'
  | 'NOT_FOUND'
  | 'SEND_FAILED'
  | 'STATUS_FAILED'
  | 'NOT_CONFIGURED'
  | 'DISCONNECT_FAILED';

/**
 * Typed error for signing domain failures.
 * The MCP layer maps these to v2 envelope error codes.
 */
export class SigningError extends Error {
  constructor(
    public readonly code: SigningErrorCode,
    message: string,
    public readonly retriable: boolean = false,
  ) {
    super(message);
    this.name = 'SigningError';
  }
}

type JsonSchema = Record<string, unknown>;
type SigningContext = {
  provider: {
    getAuthUrl(redirectUri: string, state: string): { url: string; codeVerifier: string };
    createDraft(documentRef: unknown, metadata: unknown, connection?: unknown, accessToken?: string): Promise<unknown>;
    send(draftId: string, connection?: unknown, accessToken?: string): Promise<unknown>;
    getStatus(envelopeId: string, connection?: unknown, accessToken?: string): Promise<unknown>;
    fetchArtifact(envelopeId: string, connection?: unknown, accessToken?: string): Promise<unknown>;
    disconnect(connectionId: string): Promise<void>;
  };
  storage: {
    removeConnection(connectionId: string): Promise<void>;
    storeEnvelopeStatus(id: string, status: unknown): Promise<void>;
    getEnvelopeStatus(id: string): Promise<unknown | null>;
  };
  getConnectionForKey(apiKey: string): Promise<{ connection: unknown; accessToken: string } | null>;
  uploadLocalDocument(filePath: string): Promise<unknown>;
};

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  invoke: (args: unknown) => Promise<Record<string, unknown>>;
}

// ─── Signing Context (injected at server startup) ───────────────────────────

let _signingContext: SigningContext | null = null;

export function setSigningContext(ctx: SigningContext): void {
  _signingContext = ctx;
}

function requireContext(): SigningContext {
  if (!_signingContext) {
    throw new Error('Signing not configured. Set OA_DOCUSIGN_INTEGRATION_KEY and OA_GCLOUD_ENCRYPTION_KEY environment variables.');
  }
  return _signingContext;
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const ConnectSchema = z.object({
  provider: z.enum(['docusign']).default('docusign'),
  api_key: z.string().min(1),
});

const DisconnectSchema = z.object({
  connection_id: z.string().min(1),
});

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (DocuSign limit)

const SendSchema = z.object({
  file_path: z.string().min(1).optional(),
  download_url: z.string().url().optional(),
  document_name: z.string().min(1).optional(),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    type: z.enum(['signer', 'cc']).default('signer'),
  })).min(1),
  email_subject: z.string().min(1).optional(),
  api_key: z.string().min(1).optional(), // Optional: injected from JWT sub on HTTP, passed explicitly on stdio
}).refine((d) => d.file_path || d.download_url, {
  message: 'Either file_path or download_url is required',
});

const StatusSchema = z.object({
  envelope_id: z.string().min(1),
  api_key: z.string().min(1).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateDocxFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return `File not found: ${filePath}`;
  }
  if (!filePath.toLowerCase().endsWith('.docx')) {
    return `File must be a .docx file: ${filePath}`;
  }
  const stat = statSync(filePath);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`;
  }
  return null;
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const signingTools: ToolDefinition[] = [
  {
    name: 'connect_signing_provider',
    description: 'Connect your DocuSign account for sending agreements for signature. Returns a secure OAuth URL to open in your browser.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['docusign'], description: 'Signing provider.' },
        api_key: { type: 'string', description: 'Your open_agreements_api_key.' },
      },
      required: ['api_key'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = ConnectSchema.parse(args ?? {});
      requireContext(); // Throws Error if not configured — MCP layer catches
      // Return the secure connect URL — PKCE verifier is stored in HttpOnly cookies,
      // never exposed in the URL. The connect handler generates its own PKCE challenge.
      const baseUrl = process.env.OA_BASE_URL?.trim() || 'https://openagreements.ai';
      const connectUrl = `${baseUrl}/api/auth/docusign/connect?key=${encodeURIComponent(input.api_key)}`;
      return {
        message: 'Open this URL in your browser to connect DocuSign:',
        auth_url: connectUrl,
        provider: input.provider,
      };
    },
  },

  {
    name: 'disconnect_signing_provider',
    description: 'Disconnect your signing provider account and revoke stored OAuth tokens.',
    inputSchema: {
      type: 'object',
      properties: { connection_id: { type: 'string' } },
      required: ['connection_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
    invoke: async (args) => {
      const input = DisconnectSchema.parse(args ?? {});
      try {
        const ctx = requireContext();
        await ctx.provider.disconnect(input.connection_id);
        return {
          message: `Disconnected: ${input.connection_id}`,
          connection_id: input.connection_id,
        };
      } catch (e) {
        throw new SigningError('DISCONNECT_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'send_for_signature',
    description: 'Upload a DOCX file and create a draft signing envelope. Returns a review URL — the user must review and send from the signing provider UI. Never auto-sends.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Local path to the DOCX file (for stdio MCP server).' },
        download_url: { type: 'string', description: 'URL to download the DOCX file (for remote MCP server). Use the download_url from fill_template.' },
        document_name: { type: 'string', description: "Filename for the document (e.g. 'Bonterms Mutual NDA.docx'). Auto-detected from download URL if not provided." },
        signers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              type: { type: 'string', enum: ['signer', 'cc'] },
            },
            required: ['name', 'email'],
          },
          description: 'Signers and CC recipients. First signer maps to party_1, second to party_2, etc.',
        },
        email_subject: { type: 'string', description: 'Subject line for the signing invitation email.' },
        api_key: { type: 'string', description: 'Your open_agreements_api_key for looking up the signing connection.' },
      },
      required: ['signers', 'api_key'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = SendSchema.parse(args ?? {});
      const ctx = requireContext();

      // 1. Fail fast: check connection before any file I/O
      if (!input.api_key) {
        throw new SigningError('NO_SIGNING_PROVIDER',
          'No signing connection. Authenticate first (OAuth on HTTP, or connect_signing_provider on stdio).');
      }
      const conn = await ctx.getConnectionForKey(input.api_key);
      if (!conn) {
        throw new SigningError('NO_SIGNING_PROVIDER',
          'No DocuSign connection found. Use connect_signing_provider first.');
      }

      // 2. Get the document (local file or download URL)
      let documentRef: unknown;
      let filename: string;

      if (input.download_url) {
        // Fetch from URL (remote MCP server flow)
        const response = await fetch(input.download_url);
        if (!response.ok) {
          throw new SigningError('INVALID_DOCUMENT',
            `Failed to download document: HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_FILE_SIZE_BYTES) {
          throw new SigningError('INVALID_DOCUMENT',
            `Downloaded file too large (${(buffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is 25 MB.`);
        }
        const disposition = response.headers.get('content-disposition') || '';
        const cdMatch = disposition.match(/filename="?([^";\n]+)"?/);
        filename = cdMatch?.[1] || input.document_name || 'document.docx';
        // Upload the fetched buffer to GCS
        const { createDocumentRef } = await import('./storage.js');
        const ref = createDocumentRef(buffer, filename, 'uploaded');
        const storageUrl = await (ctx as any).storage.storeDocument(buffer, filename);
        documentRef = { ...ref, storageUrl };
      } else if (input.file_path) {
        // Local file (stdio MCP server flow)
        const fileError = validateDocxFile(input.file_path);
        if (fileError) {
          throw new SigningError('INVALID_DOCUMENT', fileError);
        }
        documentRef = await ctx.uploadLocalDocument(input.file_path);
        filename = input.document_name || basename(input.file_path) || 'document.docx';
      } else {
        throw new SigningError('INVALID_DOCUMENT',
          'Either file_path or download_url is required.');
      }

      // 3. Build signing metadata
      const signingMetadata = {
        signers: input.signers.map((signer, index) => ({
          name: signer.name,
          email: signer.email,
          role: `party_${index + 1}`,
          type: signer.type,
          routingOrder: index + 1,
        })),
        emailSubject: input.email_subject || `Signature requested: ${filename}`,
      };

      // 4. Create draft envelope (never auto-send)
      try {
        const draft = await ctx.provider.createDraft(documentRef, signingMetadata, conn.connection, conn.accessToken);
        const draftResult = draft as Record<string, unknown>;

        return {
          message: 'Draft envelope created. Review and send from the link below.',
          envelope_id: draftResult.providerEnvelopeId,
          review_url: draftResult.reviewUrl,
          status: 'created',
          signers: input.signers,
        };
      } catch (e) {
        throw new SigningError('SEND_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'check_signature_status',
    description: 'Check the status of a signing envelope. When status is "completed", includes a download URL for the signed PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        envelope_id: { type: 'string' },
        api_key: { type: 'string', description: 'Your open_agreements_api_key. Required to download the signed document when completed.' },
      },
      required: ['envelope_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    invoke: async (args) => {
      const input = StatusSchema.parse(args ?? {});
      const ctx = requireContext();
      let statusData: Record<string, unknown> | null = null;

      // Try local status first (from webhook)
      try {
        const localStatus = await ctx.storage.getEnvelopeStatus(input.envelope_id);
        if (localStatus) {
          statusData = localStatus as Record<string, unknown>;
        }
      } catch (e) {
        throw new SigningError('STATUS_FAILED', (e as Error).message);
      }

      // Fall back to API call if we have a connection
      if (!statusData && input.api_key) {
        try {
          const conn = await ctx.getConnectionForKey(input.api_key);
          if (conn) {
            const apiStatus = await ctx.provider.getStatus(input.envelope_id, conn.connection, conn.accessToken);
            statusData = apiStatus as Record<string, unknown>;
          }
        } catch (e) {
          throw new SigningError('STATUS_FAILED', (e as Error).message);
        }
      }

      if (!statusData) {
        throw new SigningError('NOT_FOUND',
          'No status found. Provide api_key to query DocuSign directly.');
      }

      // If completed and we have a connection, include the signed document artifact
      if (statusData.status === 'completed' && input.api_key) {
        try {
          const conn = await ctx.getConnectionForKey(input.api_key);
          if (conn) {
            const artifact = await ctx.provider.fetchArtifact(input.envelope_id, conn.connection, conn.accessToken);
            statusData.artifact = artifact;
          }
        } catch {
          // Artifact fetch failed — return status without artifact
          statusData.artifact_note = 'Signed document could not be retrieved. Try again later.';
        }
      } else if (statusData.status === 'completed' && !input.api_key) {
        statusData.artifact_note = 'Provide api_key to download the signed document.';
      }

      return statusData;
    },
  },
];

export function listSigningToolDescriptors(): Array<{ name: string; description: string; inputSchema: JsonSchema; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }> {
  return signingTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
  }));
}

export async function callSigningTool(name: string, args: unknown): Promise<Record<string, unknown> | null> {
  const tool = signingTools.find((item) => item.name === name);
  if (!tool) return null;
  // Let SigningError and other errors propagate to the MCP layer
  // for proper v2 envelope wrapping.
  return await tool.invoke(args);
}
