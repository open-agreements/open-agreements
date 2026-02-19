/**
 * MCP (Model Context Protocol) Streamable HTTP endpoint.
 * Allows Claude and other MCP clients to use OpenAgreements as a remote tool server.
 *
 * Add as a Claude custom connector:
 *   Name: OpenAgreements
 *   URL:  https://openagreements.ai/api/mcp
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { handleFill, handleListTemplates, handleCreateChecklist, DOCX_MIME, createDownloadToken } from './_shared.js';

// ---------------------------------------------------------------------------
// Zod schemas for MCP tool argument validation
// ---------------------------------------------------------------------------

const FillTemplateArgsSchema = z.object({
  template: z.string(),
  values: z.record(z.string(), z.unknown()).optional().default({}),
});

const ListTemplatesArgsSchema = z.object({});

const CreateChecklistArgsSchema = z.object({
  deal_name: z.string(),
  created_at: z.string().optional().default(new Date().toISOString()),
  updated_at: z.string().optional().default(new Date().toISOString()),
  working_group: z.array(z.object({
    name: z.string(),
    email: z.string().optional(),
    organization: z.string(),
    role: z.string().optional(),
  })).optional().default([]),
  documents: z.array(z.object({
    document_name: z.string(),
    status: z.string(),
  })).optional().default([]),
  action_items: z.array(z.object({
    item_id: z.string(),
    description: z.string(),
    status: z.string(),
    assigned_to: z.object({
      organization: z.string(),
      individual_name: z.string().optional(),
      role: z.string().optional(),
    }),
    due_date: z.string().optional(),
  })).optional().default([]),
  open_issues: z.array(z.object({
    issue_id: z.string(),
    title: z.string(),
    status: z.string(),
    escalation_tier: z.string().optional(),
    resolution: z.string().optional(),
  })).optional().default([]),
});

// Base URL for download links — derived from the incoming request at call time
let _baseUrl = 'https://openagreements.ai';

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'list_templates',
    description:
      'List all available legal agreement templates (NDAs, SAFEs, cloud terms, employment docs) ' +
      'with their field schemas, licenses, and attribution requirements. ' +
      'Call this first to discover which templates are available and what fields they accept.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'fill_template',
    description:
      'Fill a legal agreement template with field values and return a signed-ready DOCX file. ' +
      'Fills whatever fields are provided; missing fields render as blanks. ' +
      'Use list_templates first to see available templates and their fields.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: {
          type: 'string',
          description: 'Template ID, e.g. "common-paper-mutual-nda" or "closing-checklist"',
        },
        values: {
          type: 'object',
          description: 'Field values to fill in the template. Keys are field names; values are strings, booleans, or arrays depending on field type.',
          additionalProperties: true,
        },
      },
      required: ['template'],
    },
  },
  {
    name: 'create_closing_checklist',
    description:
      'Create a deal closing checklist DOCX from structured JSON input. ' +
      'Accepts deal name, working group members, documents, action items, and open issues. ' +
      'Returns a formatted checklist for distribution to deal participants.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string', description: 'Name of the deal or transaction' },
        created_at: { type: 'string', description: 'ISO date when checklist was first created (defaults to now)' },
        updated_at: { type: 'string', description: 'ISO date when checklist was last updated (defaults to now)' },
        working_group: {
          type: 'array',
          description: 'Working group members',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              organization: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['name', 'organization'],
          },
        },
        documents: {
          type: 'array',
          description: 'Deal documents and their statuses',
          items: {
            type: 'object',
            properties: {
              document_name: { type: 'string' },
              status: { type: 'string', enum: ['NOT_STARTED', 'DRAFTING', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'NEGOTIATING', 'FORM_FINAL', 'EXECUTED', 'ON_HOLD'] },
            },
            required: ['document_name', 'status'],
          },
        },
        action_items: {
          type: 'array',
          description: 'Action items to track',
          items: {
            type: 'object',
            properties: {
              item_id: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string', enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] },
              assigned_to: {
                type: 'object',
                properties: {
                  organization: { type: 'string' },
                  individual_name: { type: 'string' },
                  role: { type: 'string' },
                },
                required: ['organization'],
              },
              due_date: { type: 'string' },
            },
            required: ['item_id', 'description', 'status', 'assigned_to'],
          },
        },
        open_issues: {
          type: 'array',
          description: 'Open issues requiring resolution',
          items: {
            type: 'object',
            properties: {
              issue_id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['OPEN', 'ESCALATED', 'RESOLVED', 'DEFERRED'] },
              escalation_tier: { type: 'string', enum: ['YELLOW', 'RED'] },
              resolution: { type: 'string' },
            },
            required: ['issue_id', 'title', 'status'],
          },
        },
      },
      required: ['deal_name'],
    },
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

// ---------------------------------------------------------------------------
// MCP method handlers
// ---------------------------------------------------------------------------

function handleInitialize(id: unknown, params: Record<string, unknown>) {
  const clientVersion = (params.protocolVersion as string) ?? '2024-11-05';
  // Accept any version the client requests; respond with the same
  return jsonRpcResult(id, {
    protocolVersion: clientVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'OpenAgreements', version: '1.0.0' },
  });
}

function handleToolsList(id: unknown) {
  return jsonRpcResult(id, { tools: TOOLS });
}

async function handleToolsCall(id: unknown, params: Record<string, unknown>) {
  const name = params.name as string;
  const args = (params.arguments as Record<string, unknown>) ?? {};

  if (name === 'list_templates') {
    const parsed = ListTemplatesArgsSchema.safeParse(args);
    if (!parsed.success) {
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}` }],
        isError: true,
      });
    }

    const { items } = handleListTemplates();

    // Build a concise human-readable summary with full field detail in JSON
    const lines = items.map(
      (t) => `- ${t.name} — ${t.description} [${t.license ?? 'recipe'}, ${t.fields.length} fields, ${t.source}]`,
    );
    const summary = `Available templates (${items.length}):\n\n${lines.join('\n')}`;

    return jsonRpcResult(id, {
      content: [
        { type: 'text', text: summary },
        { type: 'text', text: JSON.stringify(items) },
      ],
    });
  }

  if (name === 'fill_template') {
    const parsed = FillTemplateArgsSchema.safeParse(args);
    if (!parsed.success) {
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}` }],
        isError: true,
      });
    }

    const { template, values } = parsed.data;

    const outcome = await handleFill(template, values);

    if (!outcome.ok) {
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: `Error: ${outcome.error}` }],
        isError: true,
      });
    }

    const m = outcome.metadata;
    const token = createDownloadToken(template, values);
    const downloadUrl = `${_baseUrl}/api/download?token=${token}`;

    const summary = [
      `Filled "${m.template}" — ${m.filledFieldCount} of ${m.totalFieldCount} fields populated.`,
      m.missingFields.length > 0 ? `Missing fields: ${m.missingFields.join(', ')}` : 'All fields filled.',
      '',
      `Download your DOCX: ${downloadUrl}`,
      '(Link expires in 1 hour)',
      '',
      m.license ? `License: ${m.license}` : null,
      m.attribution ? `Attribution: ${m.attribution}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return jsonRpcResult(id, {
      content: [
        { type: 'text', text: summary },
      ],
    });
  }

  if (name === 'create_closing_checklist') {
    const parsed = CreateChecklistArgsSchema.safeParse(args);
    if (!parsed.success) {
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: `Validation error: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}` }],
        isError: true,
      });
    }

    const outcome = await handleCreateChecklist(parsed.data);

    if (!outcome.ok) {
      return jsonRpcResult(id, {
        content: [{ type: 'text', text: `Error: ${outcome.error}` }],
        isError: true,
      });
    }

    const token = createDownloadToken('closing-checklist', parsed.data);
    const downloadUrl = `${_baseUrl}/api/download?token=${token}`;

    const d = parsed.data;
    const summary = [
      `Created closing checklist for "${d.deal_name}".`,
      `Working group: ${d.working_group.length} members | Documents: ${d.documents.length} | Action items: ${d.action_items.length} | Open issues: ${d.open_issues.length}`,
      '',
      `Download your DOCX: ${downloadUrl}`,
      '(Link expires in 1 hour)',
    ].join('\n');

    return jsonRpcResult(id, {
      content: [{ type: 'text', text: summary }],
    });
  }

  return jsonRpcResult(id, {
    content: [{ type: 'text', text: `Unknown tool: "${name}". Available: list_templates, fill_template, create_closing_checklist.` }],
    isError: true,
  });
}

// ---------------------------------------------------------------------------
// Main handler — MCP Streamable HTTP transport
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for browser-based MCP clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are accepted' });
  }

  // Capture base URL from request for building download links
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers['x-forwarded-host'] ?? req.headers['host'] ?? 'openagreements.ai';
  _baseUrl = `${proto}://${host}`;

  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return res.status(400).json(jsonRpcError(body?.id, -32600, 'Invalid JSON-RPC 2.0 request'));
  }

  // Notifications (no id) — acknowledge without response body
  if (body.id === undefined || body.id === null) {
    return res.status(202).end();
  }

  const params = (body.params ?? {}) as Record<string, unknown>;

  try {
    switch (body.method) {
      case 'initialize':
        return res.status(200).json(handleInitialize(body.id, params));
      case 'tools/list':
        return res.status(200).json(handleToolsList(body.id));
      case 'tools/call':
        return res.status(200).json(await handleToolsCall(body.id, params));
      case 'ping':
        return res.status(200).json(jsonRpcResult(body.id, {}));
      default:
        return res.status(200).json(jsonRpcError(body.id, -32601, `Method not supported: "${body.method}"`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(200).json(jsonRpcError(body.id, -32603, `Internal error: ${message}`));
  }
}
