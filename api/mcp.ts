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
import { handleFill, handleListTemplates, DOCX_MIME, createDownloadToken } from './_shared.js';

// ---------------------------------------------------------------------------
// Zod schemas for MCP tool argument validation
// ---------------------------------------------------------------------------

const FillTemplateArgsSchema = z.object({
  template: z.string(),
  values: z.record(z.unknown()).optional().default({}),
});

const ListTemplatesArgsSchema = z.object({});

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

  return jsonRpcResult(id, {
    content: [{ type: 'text', text: `Unknown tool: "${name}". Available: list_templates, fill_template.` }],
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
