/**
 * MCP tools for agreement signing integration.
 *
 * These tools extend the contract-templates MCP with signing capabilities:
 * - connect_signing_provider: initiate OAuth with user's DocuSign account
 * - disconnect_signing_provider: revoke OAuth tokens
 * - upload_signing_document: upload an edited DOCX for signing
 * - send_for_signature: create a draft envelope (never auto-sends)
 * - check_signature_status: get envelope status
 * - get_signed_document: get download URL for signed PDF
 */

import { z } from 'zod';
import type { ToolCallResult } from './tools.js';

type JsonSchema = Record<string, unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  invoke: (args: unknown) => Promise<ToolCallResult>;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const ConnectSigningProviderSchema = z.object({
  provider: z.enum(['docusign']).default('docusign'),
  redirect_uri: z.string().url().optional(),
});

const DisconnectSigningProviderSchema = z.object({
  connection_id: z.string().min(1),
});

const UploadSigningDocumentSchema = z.object({
  file_path: z.string().min(1),
});

const SendForSignatureSchema = z.object({
  template_id: z.string().min(1).optional(),
  document_ref_id: z.string().min(1).optional(),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    type: z.enum(['signer', 'cc']).default('signer'),
  })).min(1),
  email_subject: z.string().min(1).optional(),
  send_immediately: z.boolean().default(false),
});

const CheckSignatureStatusSchema = z.object({
  envelope_id: z.string().min(1),
});

const GetSignedDocumentSchema = z.object({
  envelope_id: z.string().min(1),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function signingResult(tool: string, data: Record<string, unknown>): ToolCallResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ tool, status: 'ok', ...data }, null, 2) }],
  };
}

function signingError(tool: string, code: string, message: string): ToolCallResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ tool, status: 'error', code, message }, null, 2) }],
    isError: true,
  };
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

export const signingTools: ToolDefinition[] = [
  {
    name: 'connect_signing_provider',
    description: 'Connect your DocuSign account for sending agreements for signature. Returns an OAuth authorization URL to open in your browser.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['docusign'],
          description: 'Signing provider. Currently only "docusign" is supported.',
        },
        redirect_uri: {
          type: 'string',
          description: 'OAuth redirect URI. Defaults to the configured callback URL.',
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = ConnectSigningProviderSchema.parse(args ?? {});

      // TODO: Wire to DocuSignProvider.getAuthUrl() when storage layer is connected
      return signingResult('connect_signing_provider', {
        message: `To connect your ${input.provider} account, open this URL in your browser:`,
        auth_url: `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature+extended&client_id=INTEGRATION_KEY&redirect_uri=${encodeURIComponent(input.redirect_uri || 'http://localhost:3000/api/auth/docusign/callback')}`,
        provider: input.provider,
        note: 'After authorizing, you will be redirected back. Your connection will be saved for future use.',
      });
    },
  },

  {
    name: 'disconnect_signing_provider',
    description: 'Disconnect your signing provider account and revoke stored OAuth tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        connection_id: {
          type: 'string',
          description: 'Connection ID returned when you connected the provider.',
        },
      },
      required: ['connection_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
    invoke: async (args) => {
      const input = DisconnectSigningProviderSchema.parse(args ?? {});

      // TODO: Wire to DocuSignProvider.disconnect()
      return signingResult('disconnect_signing_provider', {
        message: `Disconnected signing provider: ${input.connection_id}`,
        connection_id: input.connection_id,
      });
    },
  },

  {
    name: 'upload_signing_document',
    description: 'Upload an edited DOCX file for signing. Use this when you\'ve downloaded and modified a filled agreement before sending for signature.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Local path to the edited DOCX file.',
        },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = UploadSigningDocumentSchema.parse(args ?? {});

      // TODO: Wire to storage.createDocumentRef() + GCS upload
      return signingResult('upload_signing_document', {
        message: `Document uploaded: ${input.file_path}`,
        document_ref: {
          id: `uploaded-${Date.now()}`,
          filename: input.file_path.split('/').pop(),
          source: 'uploaded',
        },
      });
    },
  },

  {
    name: 'send_for_signature',
    description: 'Create a draft signing envelope in DocuSign. Returns a review URL where you can verify recipients, tabs, and cover email before sending. NEVER auto-sends unless send_immediately is explicitly set to true.',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: {
          type: 'string',
          description: 'Template ID of the most recently filled template (used to look up signing config).',
        },
        document_ref_id: {
          type: 'string',
          description: 'Document reference ID from fill_template or upload_signing_document.',
        },
        signers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Full name of the signer.' },
              email: { type: 'string', description: 'Email address for signing invitation.' },
              type: { type: 'string', enum: ['signer', 'cc'], description: 'signer or cc (carbon copy).' },
            },
            required: ['name', 'email'],
          },
          description: 'List of signers and CC recipients.',
        },
        email_subject: {
          type: 'string',
          description: 'Subject line for the signing invitation email.',
        },
        send_immediately: {
          type: 'boolean',
          description: 'If true, sends immediately without review. Default: false (creates draft for review).',
        },
      },
      required: ['signers'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    invoke: async (args) => {
      const input = SendForSignatureSchema.parse(args ?? {});

      // TODO: Wire to DocuSignProvider.createDraft() + send()
      if (input.send_immediately) {
        return signingError('send_for_signature', 'NOT_IMPLEMENTED',
          'Immediate send is not yet implemented. Use the review URL to send from DocuSign.');
      }

      return signingResult('send_for_signature', {
        message: 'Draft envelope created. Review and send from DocuSign:',
        draft_id: `draft-${Date.now()}`,
        review_url: 'https://app.docusign.com/editor/placeholder',
        provider_envelope_id: `env-${Date.now()}`,
        status: 'created',
        signers: input.signers,
        note: 'Open the review URL to verify recipients, signature placement, and cover email before sending.',
      });
    },
  },

  {
    name: 'check_signature_status',
    description: 'Check the current status of a signing envelope. Returns signer statuses and timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        envelope_id: {
          type: 'string',
          description: 'Envelope ID returned by send_for_signature.',
        },
      },
      required: ['envelope_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    invoke: async (args) => {
      const input = CheckSignatureStatusSchema.parse(args ?? {});

      // TODO: Wire to DocuSignProvider.getStatus()
      return signingResult('check_signature_status', {
        envelope_id: input.envelope_id,
        status: 'created',
        signers: [],
        message: 'Envelope status retrieved.',
      });
    },
  },

  {
    name: 'get_signed_document',
    description: 'Get a download URL for the signed PDF of a completed envelope.',
    inputSchema: {
      type: 'object',
      properties: {
        envelope_id: {
          type: 'string',
          description: 'Envelope ID of the completed signing envelope.',
        },
      },
      required: ['envelope_id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    invoke: async (args) => {
      const input = GetSignedDocumentSchema.parse(args ?? {});

      // TODO: Wire to DocuSignProvider.fetchArtifact()
      return signingResult('get_signed_document', {
        envelope_id: input.envelope_id,
        download_url: 'placeholder',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        message: 'Signed document download URL.',
      });
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
  if (!tool) return null; // Not a signing tool — let the caller try other tool sets

  try {
    return await tool.invoke(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return signingError(name, 'INVALID_ARGUMENT', message);
  }
}
