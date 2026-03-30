/**
 * MCP tools for agreement signing integration.
 *
 * These tools use a SigningContext (initialized at server startup) to
 * call the DocuSign adapter with real GCloud storage. If no context
 * is available (e.g., credentials not configured), tools return
 * helpful error messages.
 */

import { z } from 'zod';
import type { ToolCallResult } from './tools.js';

type JsonSchema = Record<string, unknown>;
type SigningContext = {
  provider: {
    getAuthUrl(redirectUri: string, state: string): string;
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
  invoke: (args: unknown) => Promise<ToolCallResult>;
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
  redirect_uri: z.string().url().optional(),
});

const DisconnectSchema = z.object({
  connection_id: z.string().min(1),
});

const UploadSchema = z.object({
  file_path: z.string().min(1),
});

const SendSchema = z.object({
  template_id: z.string().min(1).optional(),
  document_ref_id: z.string().min(1).optional(),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    type: z.enum(['signer', 'cc']).default('signer'),
  })).min(1),
  email_subject: z.string().min(1).optional(),
  api_key: z.string().min(1).optional(),
  send_immediately: z.boolean().default(false),
});

const StatusSchema = z.object({
  envelope_id: z.string().min(1),
  api_key: z.string().min(1).optional(),
});

const GetDocSchema = z.object({
  envelope_id: z.string().min(1),
  api_key: z.string().min(1).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok(tool: string, data: Record<string, unknown>): ToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ tool, status: 'ok', ...data }, null, 2) }] };
}

function err(tool: string, code: string, message: string): ToolCallResult {
  return { content: [{ type: 'text', text: JSON.stringify({ tool, status: 'error', code, message }, null, 2) }], isError: true };
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const signingTools: ToolDefinition[] = [
  {
    name: 'connect_signing_provider',
    description: 'Connect your DocuSign account for sending agreements for signature. Returns an OAuth authorization URL to open in your browser.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['docusign'], description: 'Signing provider.' },
        redirect_uri: { type: 'string', description: 'OAuth redirect URI.' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = ConnectSchema.parse(args ?? {});
      try {
        const ctx = requireContext();
        const url = ctx.provider.getAuthUrl(
          input.redirect_uri || 'https://openagreements.ai/api/auth/docusign/callback',
          `mcp-${Date.now()}`,
        );
        return ok('connect_signing_provider', {
          message: 'Open this URL in your browser to connect DocuSign:',
          auth_url: url,
          provider: input.provider,
        });
      } catch (e) {
        return err('connect_signing_provider', 'NOT_CONFIGURED', (e as Error).message);
      }
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
        return ok('disconnect_signing_provider', {
          message: `Disconnected: ${input.connection_id}`,
          connection_id: input.connection_id,
        });
      } catch (e) {
        return err('disconnect_signing_provider', 'DISCONNECT_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'upload_signing_document',
    description: 'Upload an edited DOCX file for signing.',
    inputSchema: {
      type: 'object',
      properties: { file_path: { type: 'string' } },
      required: ['file_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = UploadSchema.parse(args ?? {});
      try {
        const ctx = requireContext();
        const ref = await ctx.uploadLocalDocument(input.file_path);
        return ok('upload_signing_document', {
          message: `Uploaded: ${input.file_path}`,
          document_ref: ref,
        });
      } catch (e) {
        return err('upload_signing_document', 'UPLOAD_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'send_for_signature',
    description: 'Create a draft signing envelope. Returns a review URL. NEVER auto-sends unless send_immediately is true.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string' },
        document_ref_id: { type: 'string' },
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
        },
        email_subject: { type: 'string' },
        api_key: { type: 'string', description: 'Your open_agreements_api_key for looking up the signing connection.' },
        send_immediately: { type: 'boolean' },
      },
      required: ['signers'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = SendSchema.parse(args ?? {});

      if (input.send_immediately) {
        return err('send_for_signature', 'NOT_IMPLEMENTED',
          'Immediate send not yet supported. Use the review URL to send from DocuSign.');
      }

      try {
        const ctx = requireContext();

        if (!input.api_key) {
          return err('send_for_signature', 'MISSING_API_KEY',
            'Provide your api_key to look up your DocuSign connection.');
        }

        const conn = await ctx.getConnectionForKey(input.api_key);
        if (!conn) {
          return err('send_for_signature', 'NO_SIGNING_PROVIDER',
            'No DocuSign connection found. Use connect_signing_provider first.');
        }

        // TODO: resolve documentRef from document_ref_id or last fill
        // For now, return the connection confirmation
        return ok('send_for_signature', {
          message: 'DocuSign connection found. Ready to create envelope.',
          connection_id: (conn.connection as { connectionId: string }).connectionId,
          signers: input.signers,
          note: 'Full envelope creation requires a documentRef. Upload a document first or provide document_ref_id.',
        });
      } catch (e) {
        return err('send_for_signature', 'SEND_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'check_signature_status',
    description: 'Check the status of a signing envelope.',
    inputSchema: {
      type: 'object',
      properties: {
        envelope_id: { type: 'string' },
        api_key: { type: 'string' },
      },
      required: ['envelope_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    invoke: async (args) => {
      const input = StatusSchema.parse(args ?? {});
      try {
        const ctx = requireContext();

        // Try local status first (from webhook)
        const localStatus = await ctx.storage.getEnvelopeStatus(input.envelope_id);
        if (localStatus) {
          return ok('check_signature_status', localStatus as Record<string, unknown>);
        }

        // Fall back to API call if we have a connection
        if (input.api_key) {
          const conn = await ctx.getConnectionForKey(input.api_key);
          if (conn) {
            const status = await ctx.provider.getStatus(input.envelope_id, conn.connection, conn.accessToken);
            return ok('check_signature_status', status as Record<string, unknown>);
          }
        }

        return err('check_signature_status', 'NOT_FOUND',
          'No status found. Provide api_key to query DocuSign directly.');
      } catch (e) {
        return err('check_signature_status', 'STATUS_FAILED', (e as Error).message);
      }
    },
  },

  {
    name: 'get_signed_document',
    description: 'Get a download URL for the signed PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        envelope_id: { type: 'string' },
        api_key: { type: 'string' },
      },
      required: ['envelope_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    invoke: async (args) => {
      const input = GetDocSchema.parse(args ?? {});
      try {
        const ctx = requireContext();

        if (!input.api_key) {
          return err('get_signed_document', 'MISSING_API_KEY', 'Provide api_key to fetch the signed document.');
        }

        const conn = await ctx.getConnectionForKey(input.api_key);
        if (!conn) {
          return err('get_signed_document', 'NO_SIGNING_PROVIDER', 'No DocuSign connection found.');
        }

        const artifact = await ctx.provider.fetchArtifact(input.envelope_id, conn.connection, conn.accessToken);
        return ok('get_signed_document', artifact as Record<string, unknown>);
      } catch (e) {
        return err('get_signed_document', 'FETCH_FAILED', (e as Error).message);
      }
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

export async function callSigningTool(name: string, args: unknown): Promise<ToolCallResult | null> {
  const tool = signingTools.find((item) => item.name === name);
  if (!tool) return null;

  try {
    return await tool.invoke(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(name, 'INVALID_ARGUMENT', message);
  }
}
