/**
 * MCP (Model Context Protocol) Streamable HTTP endpoint.
 * Allows Claude and other MCP clients to use OpenAgreements as a remote tool server.
 *
 * Add as a Claude custom connector:
 *   Name: OpenAgreements
 *   URL:  https://openagreements.ai/api/mcp
 */

import type { HttpRequest, HttpResponse } from './_http-types.js';
import { z } from 'zod';
import {
  handleFill,
  handleGetTemplate,
  handleListTemplates,
  DOCX_MIME,
  createDownloadArtifact,
  resolveDownloadArtifact,
  type ResolveDownloadArtifactErrorCode,
} from './_shared.js';
import { ErrorCode, makeToolError, wrapError, wrapSuccess } from './_envelope.js';

// ---------------------------------------------------------------------------
// Zod schemas for MCP tool argument validation
// ---------------------------------------------------------------------------

const ListTemplatesArgsSchema = z.object({
  mode: z.enum(['compact', 'full']).optional().default('full'),
});

const GetTemplateArgsSchema = z.object({
  template_id: z.string().min(1),
});

const FillTemplateArgsSchema = z.object({
  template: z.string().min(1),
  values: z.record(z.string(), z.unknown()).optional().default({}),
  return_mode: z.enum(['url', 'base64_docx', 'mcp_resource']).optional().default('url'),
});

const DownloadFilledArgsSchema = z.object({
  download_id: z.string().min(1),
});

// Base URL for download links — derived from the incoming request at call time
let _baseUrl = 'https://openagreements.ai';

const TOOL_LIST_TEMPLATES = 'list_templates';
const TOOL_GET_TEMPLATE = 'get_template';
const TOOL_FILL_TEMPLATE = 'fill_template';
const TOOL_DOWNLOAD_FILLED = 'download_filled';

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: TOOL_LIST_TEMPLATES,
    description:
      'List all available legal agreement templates. ' +
      'Supports compact and full metadata modes for discovery.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['compact', 'full'],
          description: 'Response detail mode. Defaults to "full".',
        },
      },
    },
  },
  {
    name: TOOL_GET_TEMPLATE,
    description:
      'Fetch a single template definition with full field metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template_id: {
          type: 'string',
          description: 'Template ID, e.g. "common-paper-mutual-nda".',
        },
      },
      required: ['template_id'],
    },
  },
  {
    name: TOOL_FILL_TEMPLATE,
    description:
      'Fill a legal agreement template with field values and return a document ' +
      'via URL, inline base64, or MCP resource preview metadata.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template: {
          type: 'string',
          description: 'Template ID, e.g. "common-paper-mutual-nda".',
        },
        values: {
          type: 'object',
          description: 'Field values to fill in the template.',
          additionalProperties: true,
        },
        return_mode: {
          type: 'string',
          enum: ['url', 'base64_docx', 'mcp_resource'],
          description: 'Artifact return mode. Defaults to "url".',
        },
      },
      required: ['template'],
    },
  },
  {
    name: TOOL_DOWNLOAD_FILLED,
    description:
      'Retrieve a filled template using a previously issued download_id. ' +
      'Returns base64 DOCX and metadata in a structured envelope.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        download_id: {
          type: 'string',
          description: 'Download ID from fill_template(url mode).',
        },
      },
      required: ['download_id'],
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

function operationalMetadata() {
  return {
    // Placeholder fields until auth/rate-limit middleware is wired.
    rate_limit: {
      limit: null,
      remaining: null,
      reset_at: null,
    },
    auth: null,
  };
}

function issueDetails(error: z.ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
  };
}

function isUnknownTemplateError(message: string): boolean {
  return message.toLowerCase().includes('unknown template');
}

function normalizedTemplate(template: {
  name: string;
  category: string;
  description: string;
  license?: string;
  source_url: string;
  source: string | null;
  attribution_text?: string;
  fields: {
    name: string;
    type: string;
    required: boolean;
    section: string | null;
    description: string;
    default: string | null;
  }[];
}) {
  return {
    template_id: template.name,
    name: template.name,
    category: template.category,
    description: template.description,
    license: template.license ?? null,
    source_url: template.source_url,
    source: template.source,
    attribution_text: template.attribution_text ?? null,
    fields: template.fields,
  };
}

function compactTemplate(template: { name: string; fields: unknown[] }) {
  return {
    template_id: template.name,
    name: template.name,
    field_count: template.fields.length,
  };
}

function toolSuccessResult(id: unknown, tool: string, data: Record<string, unknown>) {
  const envelope = wrapSuccess(tool, {
    ...data,
    ...operationalMetadata(),
  });
  return jsonRpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(envelope) }],
  });
}

function toolErrorResult(
  id: unknown,
  tool: string,
  code: (typeof ErrorCode)[keyof typeof ErrorCode],
  message: string,
  opts?: { retriable?: boolean; details?: Record<string, unknown> },
) {
  const envelope = wrapError(tool, makeToolError(code, message, opts));
  return jsonRpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(envelope) }],
    isError: true,
  });
}

function mapDownloadResolutionError(
  code: ResolveDownloadArtifactErrorCode,
): { code: (typeof ErrorCode)[keyof typeof ErrorCode]; message: string } {
  switch (code) {
    case 'DOWNLOAD_ID_MALFORMED':
      return {
        code: ErrorCode.DOWNLOAD_LINK_INVALID,
        message: 'Malformed download_id.',
      };
    case 'DOWNLOAD_SIGNATURE_INVALID':
      return {
        code: ErrorCode.DOWNLOAD_LINK_INVALID,
        message: 'Invalid download_id signature.',
      };
    case 'DOWNLOAD_EXPIRED':
      return {
        code: ErrorCode.DOWNLOAD_LINK_EXPIRED,
        message: 'Download link expired.',
      };
    case 'DOWNLOAD_NOT_FOUND':
      return {
        code: ErrorCode.DOWNLOAD_LINK_NOT_FOUND,
        message: 'Download link not found.',
      };
    default:
      return {
        code: ErrorCode.DOWNLOAD_LINK_INVALID,
        message: 'Invalid download link.',
      };
  }
}

function mcpGetHtmlPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenAgreements MCP Endpoint</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f0e8;
        --ink: #142023;
        --ink-soft: #334348;
        --card: #fff8ee;
        --line: #d2c2ae;
        --accent: #be4b2f;
        --accent-deep: #953118;
        --accent-soft: #f9dac5;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 8% -15%, #fde8d8 0, transparent 42%),
          radial-gradient(circle at 96% 10%, #e3ebf4 0, transparent 38%),
          var(--bg);
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        opacity: 0.22;
        background-image:
          linear-gradient(transparent 95%, rgba(20, 32, 35, 0.08) 96%),
          linear-gradient(90deg, transparent 95%, rgba(20, 32, 35, 0.08) 96%);
        background-size: 34px 34px;
      }
      .topbar {
        width: min(1120px, 92vw);
        margin: 18px auto 0;
        padding: 12px 16px;
        border: 1px solid var(--line);
        background: rgba(255, 248, 238, 0.76);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .brand {
        font-family: "Fraunces", Georgia, "Times New Roman", serif;
        font-size: 1.2rem;
        font-weight: 700;
        text-decoration: none;
        color: var(--ink);
      }
      .topnav {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        color: var(--ink-soft);
        font-size: 0.94rem;
      }
      .topnav a {
        color: var(--ink-soft);
        text-decoration: none;
      }
      .topnav a:hover {
        color: var(--accent-deep);
      }
      main {
        width: min(1120px, 92vw);
        margin: 24px auto 0;
        border: 1px solid var(--line);
        background: var(--card);
        box-shadow: 0 16px 50px rgba(20, 32, 35, 0.16);
        position: relative;
        z-index: 1;
      }
      section {
        padding: clamp(28px, 5vw, 56px);
      }
      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.09em;
        color: var(--accent-deep);
        font-size: 0.8rem;
        font-weight: 700;
      }
      h1 {
        margin: 0;
        font-family: "Fraunces", Georgia, "Times New Roman", serif;
        font-size: clamp(2rem, 5vw, 3.4rem);
        line-height: 1.03;
        max-width: 14ch;
      }
      p {
        margin: 12px 0 0;
        color: var(--ink-soft);
        line-height: 1.55;
        max-width: 70ch;
      }
      .actions {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        border: 1px solid transparent;
        padding: 10px 16px;
        font-weight: 600;
      }
      .btn-primary {
        background: linear-gradient(120deg, var(--accent), var(--accent-deep));
        color: #fff;
      }
      .btn-ghost {
        border-color: var(--line);
        color: var(--ink);
        background: #fff;
      }
      code {
        background: var(--bg);
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 2px 6px;
        color: var(--ink);
      }
      ul {
        margin: 14px 0 0;
        padding-left: 24px;
        color: var(--ink-soft);
      }
      li { margin: 4px 0; }
      li a {
        color: var(--accent-deep);
        text-decoration: none;
      }
      li a:hover { text-decoration: underline; }
      @media (max-width: 740px) {
        .topbar { display: block; }
        .topnav { margin-top: 8px; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <a class="brand" href="https://openagreements.ai">OpenAgreements</a>
      <nav class="topnav">
        <a href="https://openagreements.ai/templates">Template Library</a>
        <span>|</span>
        <a href="https://openagreements.ai#start">Install Guide</a>
        <span>|</span>
        <a href="https://openagreements.ai#faq">Q&A</a>
      </nav>
    </header>
    <main>
      <section>
        <p class="eyebrow">Open-source legal operations</p>
        <h1>OpenAgreements MCP endpoint</h1>
        <p>This route is for MCP clients (streamable HTTP), not direct browser use.</p>
        <p>Endpoint: <code>https://openagreements.ai/api/mcp</code></p>
        <p>Use JSON-RPC over HTTP POST with methods like <code>initialize</code>, <code>tools/list</code>, and <code>tools/call</code>.</p>
        <div class="actions">
          <a class="btn btn-primary" href="https://openagreements.ai#start">Installation instructions</a>
          <a class="btn btn-ghost" href="https://openagreements.ai/templates">Browse templates</a>
        </div>
        <ul>
          <li>Website: <a href="https://openagreements.ai">openagreements.ai</a></li>
          <li>GitHub: <a href="https://github.com/open-agreements/open-agreements">open-agreements/open-agreements</a></li>
        </ul>
      </section>
    </main>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// MCP method handlers
// ---------------------------------------------------------------------------

function handleInitialize(id: unknown, params: Record<string, unknown>) {
  const clientVersion = (params.protocolVersion as string) ?? '2024-11-05';
  // Accept any version the client requests; respond with the same.
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

  if (name === TOOL_LIST_TEMPLATES) {
    const parsed = ListTemplatesArgsSchema.safeParse(args);
    if (!parsed.success) {
      return toolErrorResult(
        id,
        TOOL_LIST_TEMPLATES,
        ErrorCode.INVALID_ARGUMENT,
        'Invalid arguments for list_templates.',
        { details: issueDetails(parsed.error) },
      );
    }

    const { mode } = parsed.data;
    const { items } = handleListTemplates();

    if (mode === 'compact') {
      return toolSuccessResult(id, TOOL_LIST_TEMPLATES, {
        mode,
        templates: items.map((item) => compactTemplate(item)),
      });
    }

    return toolSuccessResult(id, TOOL_LIST_TEMPLATES, {
      mode,
      templates: items.map((item) => normalizedTemplate(item)),
    });
  }

  if (name === TOOL_GET_TEMPLATE) {
    const parsed = GetTemplateArgsSchema.safeParse(args);
    if (!parsed.success) {
      return toolErrorResult(
        id,
        TOOL_GET_TEMPLATE,
        ErrorCode.INVALID_ARGUMENT,
        'Invalid arguments for get_template.',
        { details: issueDetails(parsed.error) },
      );
    }

    const template = handleGetTemplate(parsed.data.template_id);
    if (!template) {
      return toolErrorResult(
        id,
        TOOL_GET_TEMPLATE,
        ErrorCode.TEMPLATE_NOT_FOUND,
        `Template not found: "${parsed.data.template_id}"`,
      );
    }

    return toolSuccessResult(id, TOOL_GET_TEMPLATE, {
      template: normalizedTemplate(template),
    });
  }

  if (name === TOOL_FILL_TEMPLATE) {
    const parsed = FillTemplateArgsSchema.safeParse(args);
    if (!parsed.success) {
      return toolErrorResult(
        id,
        TOOL_FILL_TEMPLATE,
        ErrorCode.INVALID_ARGUMENT,
        'Invalid arguments for fill_template.',
        { details: issueDetails(parsed.error) },
      );
    }

    const { template, values, return_mode } = parsed.data;

    const outcome = await handleFill(template, values);

    if (!outcome.ok) {
      const errorCode = isUnknownTemplateError(outcome.error)
        ? ErrorCode.TEMPLATE_NOT_FOUND
        : ErrorCode.INVALID_ARGUMENT;
      return toolErrorResult(id, TOOL_FILL_TEMPLATE, errorCode, outcome.error);
    }

    if (return_mode === 'base64_docx') {
      return toolSuccessResult(id, TOOL_FILL_TEMPLATE, {
        content_type: DOCX_MIME,
        docx_base64: outcome.base64,
        metadata: outcome.metadata,
        return_mode,
      });
    }

    const artifact = await createDownloadArtifact(template, values);
    const downloadUrl = `${_baseUrl}/api/download?id=${encodeURIComponent(artifact.download_id)}`;
    const expiresAt = artifact.expires_at;

    if (return_mode === 'mcp_resource') {
      return toolSuccessResult(id, TOOL_FILL_TEMPLATE, {
        content_type: DOCX_MIME,
        download_url: downloadUrl,
        expires_at: expiresAt,
        metadata: outcome.metadata,
        download_id: artifact.download_id,
        resource_uri: `oa://filled/${artifact.download_id}`,
        return_mode,
      });
    }

    return toolSuccessResult(id, TOOL_FILL_TEMPLATE, {
      download_url: downloadUrl,
      download_id: artifact.download_id,
      expires_at: expiresAt,
      metadata: outcome.metadata,
      return_mode,
    });
  }

  if (name === TOOL_DOWNLOAD_FILLED) {
    const parsed = DownloadFilledArgsSchema.safeParse(args);
    if (!parsed.success) {
      return toolErrorResult(
        id,
        TOOL_DOWNLOAD_FILLED,
        ErrorCode.INVALID_ARGUMENT,
        'Invalid arguments for download_filled.',
        { details: issueDetails(parsed.error) },
      );
    }

    const resolved = await resolveDownloadArtifact(parsed.data.download_id);
    if (!resolved.ok) {
      const mapped = mapDownloadResolutionError(resolved.code);
      return toolErrorResult(id, TOOL_DOWNLOAD_FILLED, mapped.code, mapped.message);
    }

    const outcome = await handleFill(resolved.artifact.template, resolved.artifact.values);
    if (!outcome.ok) {
      const errorCode = isUnknownTemplateError(outcome.error)
        ? ErrorCode.TEMPLATE_NOT_FOUND
        : ErrorCode.INVALID_ARGUMENT;
      return toolErrorResult(id, TOOL_DOWNLOAD_FILLED, errorCode, outcome.error);
    }

    return toolSuccessResult(id, TOOL_DOWNLOAD_FILLED, {
      content_type: DOCX_MIME,
      docx_base64: outcome.base64,
      metadata: outcome.metadata,
      download_id: parsed.data.download_id,
      download_expires_at: new Date(resolved.artifact.expires_at_ms).toISOString(),
    });
  }

  return toolErrorResult(
    id,
    name || 'tools/call',
    ErrorCode.INVALID_ARGUMENT,
    `Unknown tool: "${name}"`,
    { details: { available_tools: TOOLS.map((tool) => tool.name) } },
  );
}

// ---------------------------------------------------------------------------
// Main handler — MCP Streamable HTTP transport
// ---------------------------------------------------------------------------

export default async function handler(req: HttpRequest, res: HttpResponse) {
  // CORS for browser-based MCP clients.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const acceptHeader = req.headers['accept'];
    const accept = Array.isArray(acceptHeader) ? acceptHeader.join(',') : (acceptHeader ?? '');
    if (accept.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(mcpGetHtmlPage());
    }
    return res.status(405).json({ error: 'Only POST requests are accepted for MCP clients' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are accepted for MCP clients' });
  }

  // Capture base URL from request for building download links.
  const proto = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers['x-forwarded-host'] ?? req.headers['host'] ?? 'openagreements.ai';
  _baseUrl = `${proto}://${host}`;

  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return res.status(400).json(jsonRpcError(body?.id, -32600, 'Invalid JSON-RPC 2.0 request'));
  }

  // Notifications (no id) — acknowledge without response body.
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
        // NOTE: Auth middleware would intercept protected routes before this point.
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
