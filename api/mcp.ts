/**
 * MCP (Model Context Protocol) Streamable HTTP endpoint.
 * Allows Claude and other MCP clients to use OpenAgreements as a remote tool server.
 *
 * Add as a Claude custom connector:
 *   Name: OpenAgreements
 *   URL:  https://openagreements.org/api/mcp
 */

import type { HttpRequest, HttpResponse } from './_http-types.js';
import { z } from 'zod';
import {
  handleFill,
  handleGetTemplate,
  handleListTemplates,
  searchTemplates,
  DOCX_MIME,
  createDownloadArtifact,
  generateRedlineFromFill,
  DownloadStoreUnavailableError,
  DownloadStoreConfigurationError,
} from './_shared.js';
import { ErrorCode, makeToolError, wrapError, wrapSuccess } from './_envelope.js';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { OA_ORIGIN, MCP_RESOURCE, OA_PACKAGE_VERSION, isMcpSigningConfigured } from './_config.js';
import { SigningError } from '../packages/signing/src/mcp-tools.js';
import {
  getRequestContext,
  redactBearer,
  normalizeError,
  info as logInfo,
  error as logError,
  type RequestContext,
} from './_log.js';
import {
  checkRateLimit,
  combineState,
  getClientIp,
  readFillLimit,
  readGlobalLimit,
  type RateLimitState,
} from './_ratelimit.js';

// ---------------------------------------------------------------------------
// Zod schemas for MCP tool argument validation
// ---------------------------------------------------------------------------

const ListTemplatesArgsSchema = z.object({
  mode: z.enum(['compact', 'full']).optional().default('compact'),
});

const GetTemplateArgsSchema = z.object({
  template_id: z.string().min(1).optional(),
  template: z.string().min(1).optional(),
}).transform((v) => ({ template_id: v.template_id ?? v.template ?? '' }))
  .refine((v) => v.template_id.length > 0, { message: 'template_id or template is required' });

const FillTemplateArgsSchema = z.object({
  template: z.string().min(1).optional(),
  template_id: z.string().min(1).optional(),
  values: z.record(z.string(), z.unknown()).optional().default({}),
  return_mode: z.enum(['url', 'mcp_resource']).optional().default('url'),
  include_redline: z.boolean().optional().default(true),
  redline_base: z.enum(['source', 'clean']).optional().default('source'),
}).transform((v) => ({ ...v, template: v.template ?? v.template_id ?? '' }))
  .refine((v) => v.template.length > 0, { message: 'template or template_id is required' });

const SearchTemplatesArgsSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  source: z.string().optional(),
  max_results: z.number().int().min(1).max(50).optional().default(10),
});

// ---------------------------------------------------------------------------
// OAuth JWT verification for signing tools
// ---------------------------------------------------------------------------

const JWKS_URI = `${OA_ORIGIN}/api/auth/jwks`;

// Signing tools that require auth on the HTTP transport
const AUTH_REQUIRED_TOOLS = new Set([
  'send_for_signature',
  'check_signature_status',
]);

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(JWKS_URI));
  return _jwks;
}

type AuthResult = {
  authenticated: false;
  status: 401 | 403;
  error: string;
  errorDescription: string;
} | {
  authenticated: true;
  sub: string;
  scope: string;
};

async function verifyAuth(req: HttpRequest): Promise<AuthResult> {
  const authHeader = Array.isArray(req.headers['authorization'])
    ? req.headers['authorization'][0]
    : req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authenticated: false,
      status: 401,
      error: 'invalid_token',
      errorDescription: 'Bearer token required for signing tools',
    };
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: OA_ORIGIN,
      audience: MCP_RESOURCE,
    });

    const scope = (payload.scope as string) || '';
    if (!scope.includes('signing')) {
      return {
        authenticated: false,
        status: 403,
        error: 'insufficient_scope',
        errorDescription: 'Token lacks "signing" scope',
      };
    }

    return {
      authenticated: true,
      sub: payload.sub || '',
      scope,
    };
  } catch (e) {
    return {
      authenticated: false,
      status: 401,
      error: 'invalid_token',
      errorDescription: (e as Error).message,
    };
  }
}

const TOOL_LIST_TEMPLATES = 'list_templates';
const TOOL_SEARCH_TEMPLATES = 'search_templates';
const TOOL_GET_TEMPLATE = 'get_template';
const TOOL_FILL_TEMPLATE = 'fill_template';

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: TOOL_LIST_TEMPLATES,
    description:
      'List all available legal agreement templates. ' +
      'Supports compact and full metadata modes for browsing. ' +
      'For finding templates by topic, jurisdiction, or source, use search_templates instead.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['compact', 'full'],
          description: 'Response detail mode. Defaults to "compact".',
        },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  {
    name: TOOL_SEARCH_TEMPLATES,
    description:
      'Search for legal agreement templates by keyword. Uses BM25 ranking to find ' +
      'the most relevant templates matching your query. Searches across template names, ' +
      'descriptions, categories, sources, and field definitions. ' +
      'Use this instead of list_templates when you know what kind of agreement you need.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Search query. Examples: "NDA", "employment offer letter", ' +
            '"NVCA stock purchase", "data processing GDPR", "non-compete Wyoming".',
        },
        category: {
          type: 'string',
          description:
            'Optional category filter (exact, case-insensitive). Values: confidentiality, ' +
            'employment, sales-licensing, data-compliance, deals-partnerships, ' +
            'professional-services, venture-financing, other.',
        },
        source: {
          type: 'string',
          description:
            'Optional source filter (exact, case-insensitive). Values: "Common Paper", ' +
            '"Bonterms", "Y Combinator", "NVCA", "OpenAgreements".',
        },
        max_results: {
          type: 'number',
          description: 'Maximum results to return (1-50, default 10).',
        },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
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
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  {
    name: TOOL_FILL_TEMPLATE,
    description:
      'Fill a legal agreement template with field values and return a document ' +
      'via URL or MCP resource preview metadata. ' +
      'For recipe templates (e.g. NVCA), also generates a redline (track-changes) ' +
      'document comparing the filled output against the standard form.',
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
          enum: ['url', 'mcp_resource'],
          description: 'Artifact return mode. Defaults to "url".',
        },
        include_redline: {
          type: 'boolean',
          description: 'Generate a redline (track-changes) document. Defaults to true for recipes.',
        },
        redline_base: {
          type: 'string',
          enum: ['source', 'clean'],
          description: 'Base document for redline comparison. "source" = raw standard form (default), "clean" = cleaned intermediate.',
        },
      },
      required: ['template'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
];

// ---------------------------------------------------------------------------
// Signing tool definitions — gated on isMcpSigningConfigured()
// ---------------------------------------------------------------------------

const TOOL_SEND_FOR_SIGNATURE = 'send_for_signature';
const TOOL_CHECK_SIGNATURE_STATUS = 'check_signature_status';

const SIGNING_TOOL_NAMES = new Set([
  TOOL_SEND_FOR_SIGNATURE,
  TOOL_CHECK_SIGNATURE_STATUS,
]);

// Remote MCP signing tools — no api_key, no connect/disconnect (auth via JWT Bearer)
const SIGNING_TOOLS = [
  {
    name: TOOL_SEND_FOR_SIGNATURE,
    description:
      'Upload a DOCX file and create a draft signing envelope via DocuSign. ' +
      'Returns a review URL — the user must review and send from DocuSign. Never auto-sends. ' +
      'Authentication is handled automatically via OAuth — no API key needed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        download_url: { type: 'string', description: 'URL to download the DOCX file. Use the download_url from fill_template.' },
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
          description: 'Signers and CC recipients. First signer maps to party_1, second to party_2.',
        },
        email_subject: { type: 'string', description: 'Subject line for the signing invitation email.' },
      },
      required: ['signers'] as const,
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  {
    name: TOOL_CHECK_SIGNATURE_STATUS,
    description:
      'Check the status of a signing envelope. When status is "completed", ' +
      'includes a download URL for the signed PDF.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        envelope_id: { type: 'string', description: 'The envelope ID returned by send_for_signature.' },
      },
      required: ['envelope_id'] as const,
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
];

function getAvailableTools() {
  return isMcpSigningConfigured() ? [...TOOLS, ...SIGNING_TOOLS] : [...TOOLS];
}

// ---------------------------------------------------------------------------
// Signing context — lazy initialization from env vars
// ---------------------------------------------------------------------------

let _signingModuleLoaded = false;

async function handleSigningToolCall(
  id: unknown,
  name: string,
  args: Record<string, unknown>,
  ctx: RequestContext,
  rateState: RateLimitState | null,
): Promise<ReturnType<typeof jsonRpcResult>> {
  try {
    if (!_signingModuleLoaded) {
      // Dynamic import to avoid bundling when signing isn't configured
      const { setSigningContext } = await import(
        '../packages/signing/src/mcp-tools.js'
      );
      const { createSigningContext } = await import(
        '../packages/signing/src/context.js'
      );

      // Trim env vars — Vercel env vars may have trailing whitespace/newlines
      const env = (key: string) => process.env[key]?.trim();

      if (isMcpSigningConfigured()) {
        // Non-null assertions justified by isMcpSigningConfigured() contract.
        const integrationKey = env('OA_DOCUSIGN_INTEGRATION_KEY')!;
        const secretKey = env('OA_DOCUSIGN_SECRET_KEY')!;
        const encryptionKeyHex = env('OA_GCLOUD_ENCRYPTION_KEY')!;
        // Parse SA credentials from env var (Vercel has no ADC)
        let gcloudCredentials: { client_email: string; private_key: string; [key: string]: unknown } | undefined;
        const credentialsJson = env('GOOGLE_APPLICATION_CREDENTIALS_JSON');
        if (credentialsJson) {
          try {
            gcloudCredentials = JSON.parse(credentialsJson);
          } catch {
            // Fall back to ADC if JSON is malformed
          }
        }

        const ctx = createSigningContext({
          docusign: {
            integrationKey,
            secretKey,
            redirectUri: env('OA_DOCUSIGN_REDIRECT_URI')
              || 'https://openagreements.ai/api/auth/docusign/callback',
            hmacSecret: env('OA_DOCUSIGN_HMAC_SECRET'),
            sandbox: env('OA_DOCUSIGN_SANDBOX') !== 'false',
          },
          gcloud: {
            projectId: env('GOOGLE_CLOUD_PROJECT') || 'open-agreements',
            bucketName: 'openagreements-signing-artifacts',
            encryptionKey: Buffer.from(encryptionKeyHex, 'hex'),
            ...(gcloudCredentials ? { credentials: gcloudCredentials } : {}),
          },
        });
        setSigningContext(ctx);
      }
      _signingModuleLoaded = true;
    }

    const { callSigningTool } = await import(
      '../packages/signing/src/mcp-tools.js'
    );
    const result = await callSigningTool(name, args);

    if (!result) {
      return toolErrorResult(id, name, ErrorCode.INVALID_ARGUMENT, `Unknown signing tool: "${name}"`);
    }

    return toolSuccessResult(id, name, result, rateState);
  } catch (err) {
    // SigningError: domain-specific error with a discriminated code.
    // Map to the appropriate v2 envelope error code.
    if (err instanceof SigningError) {
      const envelopeCode = err.code === 'INVALID_DOCUMENT'
        ? ErrorCode.INVALID_ARGUMENT
        : ErrorCode.INTERNAL_ERROR;
      logError({
        event: 'tool_internal_error',
        endpoint: 'mcp',
        tool: name,
        phase: 'signing',
        signingCode: err.code,
        jsonrpcId: id,
        ...normalizeError(err),
        ...ctx,
      });
      return toolErrorResult(id, name, envelopeCode, err.message, {
        retriable: err.retriable,
        details: { reason: err.code },
      });
    }
    // Non-SigningError: module init/import failure or unexpected runtime error.
    const message = err instanceof Error ? err.message : String(err);
    logError({
      event: 'tool_internal_error',
      endpoint: 'mcp',
      tool: name,
      phase: 'signing',
      jsonrpcId: id,
      ...normalizeError(err),
      ...ctx,
    });
    if (!isMcpSigningConfigured()) {
      return toolErrorResult(id, name, ErrorCode.INTERNAL_ERROR,
        'Signing is not configured for this deployment.',
        { retriable: false, details: { reason: 'SIGNING_NOT_CONFIGURED' } });
    }
    return toolErrorResult(id, name, ErrorCode.INTERNAL_ERROR,
      `Signing error: ${message}`,
      { retriable: false });
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function jsonRpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function operationalMetadata(state: RateLimitState | null) {
  if (state && state.configured) {
    return {
      rate_limit: {
        limit: state.limit,
        remaining: state.remaining,
        reset_at: state.reset_at,
        bucket: state.bucket,
      },
      auth: null,
    };
  }
  // Limiter unconfigured (dev/test) or runtime-failed-open. Truthful nulls.
  return {
    rate_limit: {
      limit: null,
      remaining: null,
      reset_at: null,
      bucket: null,
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
  display_name: string;
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
    display_name: template.display_name,
    category: template.category,
    description: template.description,
    license: template.license ?? null,
    source_url: template.source_url,
    source: template.source,
    attribution_text: template.attribution_text ?? null,
    fields: template.fields,
  };
}

function compactTemplate(template: { name: string; display_name: string; fields: unknown[] }) {
  return {
    template_id: template.name,
    name: template.name,
    display_name: template.display_name,
    field_count: template.fields.length,
  };
}

function toolSuccessResult(
  id: unknown,
  tool: string,
  data: Record<string, unknown>,
  state: RateLimitState | null = null,
) {
  const envelope = wrapSuccess(tool, {
    ...data,
    ...operationalMetadata(state),
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

/**
 * Build a RATE_LIMITED envelope plus the seconds-to-reset for `Retry-After`.
 * Always retriable. State must be `configured: true && allowed: false`.
 */
function buildRateLimitedResult(
  id: unknown,
  tool: string,
  state: Extract<RateLimitState, { configured: true }>,
): { result: ReturnType<typeof toolErrorResult>; retryAfterSec: number } {
  const resetAtMs = Date.parse(state.reset_at);
  const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000));
  const result = toolErrorResult(
    id,
    tool,
    ErrorCode.RATE_LIMITED,
    `Rate limit exceeded for bucket "${state.bucket}". Retry after ${state.reset_at}.`,
    {
      retriable: true,
      details: {
        rate_limit: {
          limit: state.limit,
          remaining: 0,
          reset_at: state.reset_at,
          bucket: state.bucket,
        },
      },
    },
  );
  return { result, retryAfterSec };
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
        <p>Endpoint: <code>https://openagreements.org/api/mcp</code></p>
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
    serverInfo: { name: 'OpenAgreements', version: OA_PACKAGE_VERSION },
  });
}

function handleToolsList(id: unknown) {
  return jsonRpcResult(id, { tools: getAvailableTools() });
}

async function handleToolsCall(
  id: unknown,
  params: Record<string, unknown>,
  ctx: RequestContext,
  rateState: RateLimitState | null,
) {
  const name = params.name as string;
  const args = (params.arguments as Record<string, unknown>) ?? {};

  // Delegate signing tools to the signing module
  // Inject __auth_sub as api_key so downstream Zod validation passes
  if (SIGNING_TOOL_NAMES.has(name)) {
    if (args.__auth_sub && !args.api_key) {
      args.api_key = args.__auth_sub;
    }
    return handleSigningToolCall(id, name, args, ctx, rateState);
  }

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
      }, rateState);
    }

    return toolSuccessResult(id, TOOL_LIST_TEMPLATES, {
      mode,
      templates: items.map((item) => normalizedTemplate(item)),
    }, rateState);
  }

  if (name === TOOL_SEARCH_TEMPLATES) {
    const parsed = SearchTemplatesArgsSchema.safeParse(args);
    if (!parsed.success) {
      return toolErrorResult(
        id,
        TOOL_SEARCH_TEMPLATES,
        ErrorCode.INVALID_ARGUMENT,
        'Invalid arguments for search_templates.',
        { details: issueDetails(parsed.error) },
      );
    }

    const { items } = handleListTemplates();
    const results = searchTemplates(items, parsed.data);

    return toolSuccessResult(id, TOOL_SEARCH_TEMPLATES, {
      query: parsed.data.query,
      category_filter: parsed.data.category ?? null,
      source_filter: parsed.data.source ?? null,
      result_count: results.length,
      results,
    }, rateState);
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
    }, rateState);
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

    const { template, values, return_mode, include_redline, redline_base } = parsed.data;

    let outcome: Awaited<ReturnType<typeof handleFill>>;
    try {
      outcome = await handleFill(template, values);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError({
        event: 'tool_internal_error',
        endpoint: 'mcp',
        tool: TOOL_FILL_TEMPLATE,
        phase: 'fill',
        jsonrpcId: id,
        ...normalizeError(err),
        ...ctx,
      });
      return toolErrorResult(
        id,
        TOOL_FILL_TEMPLATE,
        ErrorCode.INTERNAL_ERROR,
        `Fill failed: ${message}`,
        { retriable: false },
      );
    }

    if (!outcome.ok) {
      const errorCode = isUnknownTemplateError(outcome.error)
        ? ErrorCode.TEMPLATE_NOT_FOUND
        : ErrorCode.INVALID_ARGUMENT;
      return toolErrorResult(id, TOOL_FILL_TEMPLATE, errorCode, outcome.error);
    }

    let artifact: Awaited<ReturnType<typeof createDownloadArtifact>>;
    try {
      artifact = await createDownloadArtifact(template, values);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof DownloadStoreUnavailableError) {
        const cause = err instanceof DownloadStoreConfigurationError ? 'configuration' : 'runtime';
        logError({
          event: 'tool_internal_error',
          endpoint: 'mcp',
          tool: TOOL_FILL_TEMPLATE,
          phase: 'artifact',
          cause,
          jsonrpcId: id,
          ...normalizeError(err),
          ...ctx,
        });
        return toolErrorResult(
          id,
          TOOL_FILL_TEMPLATE,
          ErrorCode.INTERNAL_ERROR,
          `Download storage is unavailable: ${message}`,
          {
            retriable: cause === 'runtime',
            details: { reason: 'DOWNLOAD_STORE_UNAVAILABLE', cause },
          },
        );
      }
      logError({
        event: 'tool_internal_error',
        endpoint: 'mcp',
        tool: TOOL_FILL_TEMPLATE,
        phase: 'artifact',
        jsonrpcId: id,
        ...normalizeError(err),
        ...ctx,
      });
      return toolErrorResult(
        id,
        TOOL_FILL_TEMPLATE,
        ErrorCode.INTERNAL_ERROR,
        `Download artifact creation failed: ${message}`,
        { retriable: false },
      );
    }
    const downloadUrl = `${ctx.baseUrl}/api/download?id=${encodeURIComponent(artifact.download_id)}`;
    const expiresAt = artifact.expires_at;

    // Generate redline (track-changes) for recipe templates
    let redlineData: Record<string, unknown> = {};
    if (include_redline) {
      try {
        const redline = await generateRedlineFromFill(template, outcome.base64, redline_base, values);
        if (redline) {
          const redlineArtifact = await createDownloadArtifact(template, values, {
            variant: 'redline',
            redline_base,
          });
          const redlineUrl = `${ctx.baseUrl}/api/download?id=${encodeURIComponent(redlineArtifact.download_id)}`;
          redlineData = {
            redline_download_url: redlineUrl,
            redline_download_id: redlineArtifact.download_id,
            redline_expires_at: redlineArtifact.expires_at,
            redline_stats: redline.stats,
          };
        }
      } catch (err) {
        // Redline generation is best-effort; log but don't fail the fill.
        // parentOk:true so dashboards can distinguish a redline-only blip
        // from a hard fill failure.
        logError({
          event: 'tool_internal_error',
          endpoint: 'mcp',
          tool: TOOL_FILL_TEMPLATE,
          phase: 'redline',
          parentOk: true,
          jsonrpcId: id,
          ...normalizeError(err),
          ...ctx,
        });
      }
    }

    if (return_mode === 'mcp_resource') {
      return toolSuccessResult(id, TOOL_FILL_TEMPLATE, {
        content_type: DOCX_MIME,
        download_url: downloadUrl,
        expires_at: expiresAt,
        metadata: outcome.metadata,
        download_id: artifact.download_id,
        resource_uri: `oa://filled/${artifact.download_id}`,
        return_mode,
        ...redlineData,
      }, rateState);
    }

    return toolSuccessResult(id, TOOL_FILL_TEMPLATE, {
      download_url: downloadUrl,
      download_id: artifact.download_id,
      expires_at: expiresAt,
      metadata: outcome.metadata,
      return_mode,
      ...redlineData,
    }, rateState);
  }

  return toolErrorResult(
    id,
    name || 'tools/call',
    ErrorCode.INVALID_ARGUMENT,
    `Unknown tool: "${name}"`,
    { details: { available_tools: getAvailableTools().map((tool) => tool.name) } },
  );
}

// ---------------------------------------------------------------------------
// Main handler — MCP Streamable HTTP transport
// ---------------------------------------------------------------------------

export default async function handler(req: HttpRequest, res: HttpResponse) {
  // CORS for browser-based MCP clients (includes Authorization for OAuth).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');

  // OPTIONS preflight — no logging, just the platform-required CORS handshake.
  if (req.method === 'OPTIONS') return res.status(204).end();

  const ctx = getRequestContext(req);
  const startedAt = Date.now();

  // Helper: emit request_complete and return the response. Every non-OPTIONS
  // terminal path goes through this so we always have a record with status,
  // ok, durationMs, and ctx for the request.
  const complete = (
    status: number,
    ok: boolean,
    extra: { jsonrpcMethod?: string; toolName?: string; jsonrpcId?: unknown },
    payload: unknown,
    sender: 'json' | 'send' = 'json',
  ) => {
    logInfo({
      event: 'request_complete',
      endpoint: 'mcp',
      status,
      ok,
      durationMs: Date.now() - startedAt,
      ...extra,
      ...ctx,
    });
    if (sender === 'send') return res.status(status).send(payload);
    return res.status(status).json(payload);
  };

  if (req.method === 'GET') {
    const acceptHeader = req.headers['accept'];
    const accept = Array.isArray(acceptHeader) ? acceptHeader.join(',') : (acceptHeader ?? '');
    if (accept.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return complete(200, true, {}, mcpGetHtmlPage(), 'send');
    }
    logInfo({
      event: 'request_rejected_http_method',
      endpoint: 'mcp',
      method: req.method,
      status: 405,
      ...ctx,
    });
    return complete(405, false, {}, { error: 'Only POST requests are accepted for MCP clients' });
  }

  if (req.method !== 'POST') {
    logInfo({
      event: 'request_rejected_http_method',
      endpoint: 'mcp',
      method: req.method,
      status: 405,
      ...ctx,
    });
    return complete(405, false, {}, { error: 'Only POST requests are accepted for MCP clients' });
  }

  const body = req.body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    logError({
      event: 'request_rejected_invalid_jsonrpc',
      endpoint: 'mcp',
      status: 400,
      jsonrpcId: body?.id,
      ...ctx,
    });
    return complete(400, false, { jsonrpcId: body?.id }, jsonRpcError(body?.id, -32600, 'Invalid JSON-RPC 2.0 request'));
  }

  // Rate limit check happens BEFORE the notification short-circuit so spammed
  // notifications still count against the global bucket. We deliberately do
  // not include OPTIONS/GET in the limiter — they're handled above.
  const clientIp = getClientIp(req);
  const globalState = await checkRateLimit('mcp:global', clientIp, readGlobalLimit());

  if (globalState.configured && !globalState.allowed) {
    const tool = body.method === 'tools/call'
      ? (((body.params ?? {}) as { name?: string }).name ?? 'tools/call')
      : body.method;
    const { result, retryAfterSec } = buildRateLimitedResult(body.id, tool, globalState);
    res.setHeader('Retry-After', String(retryAfterSec));
    logInfo({
      event: 'rate_limited',
      endpoint: 'mcp',
      bucket: 'mcp:global',
      jsonrpcMethod: body.method,
      jsonrpcId: body.id,
      ...ctx,
    });
    return complete(200, false, { jsonrpcMethod: body.method, jsonrpcId: body.id }, result);
  }

  // Notifications (no id) — acknowledge without response body. Counted above.
  if (body.id === undefined || body.id === null) {
    logInfo({
      event: 'notification',
      endpoint: 'mcp',
      jsonrpcMethod: body.method,
      ...ctx,
    });
    logInfo({
      event: 'request_complete',
      endpoint: 'mcp',
      status: 202,
      ok: true,
      durationMs: Date.now() - startedAt,
      jsonrpcMethod: body.method,
      ...ctx,
    });
    return res.status(202).end();
  }

  const params = (body.params ?? {}) as Record<string, unknown>;

  // Capture tool name up front so the outer catch can envelope-wrap unexpected
  // throws during tools/call handling. (auth injection at the tools/call case
  // only mutates params.arguments, not params.name.)
  const requestedToolName =
    body.method === 'tools/call'
      ? ((params as { name?: unknown }).name as string | undefined)
      : undefined;

  logInfo({
    event: 'request_start',
    endpoint: 'mcp',
    jsonrpcMethod: body.method,
    toolName: requestedToolName,
    jsonrpcId: body.id,
    ...ctx,
  });

  const trace = { jsonrpcMethod: body.method, toolName: requestedToolName, jsonrpcId: body.id };

  try {
    switch (body.method) {
      case 'initialize':
        return complete(200, true, trace, handleInitialize(body.id, params));
      case 'tools/list':
        return complete(200, true, trace, handleToolsList(body.id));
      case 'tools/call': {
        // Check if this tool requires authentication
        const toolName = (params as { name?: string }).name;
        if (toolName && AUTH_REQUIRED_TOOLS.has(toolName)) {
          const auth = await verifyAuth(req);
          if (!auth.authenticated) {
            logError({
              event: 'auth_denied',
              endpoint: 'mcp',
              status: auth.status,
              error: auth.error,
              toolName,
              jsonrpcId: body.id,
              ...redactBearer(req.headers['authorization']),
              ...ctx,
            });
            if (auth.status === 401) {
              res.setHeader('WWW-Authenticate',
                `Bearer resource_metadata="${OA_ORIGIN}/.well-known/oauth-protected-resource"`);
              return complete(401, false, trace, jsonRpcError(body.id, -32001, auth.errorDescription));
            }
            return complete(403, false, trace, jsonRpcError(body.id, -32001, auth.errorDescription));
          }
          // Pass auth context to handler via arguments (where signing tools read it)
          const toolArgs = ((params as Record<string, unknown>).arguments ?? {}) as Record<string, unknown>;
          toolArgs.__auth_sub = auth.sub;
          (params as Record<string, unknown>).arguments = toolArgs;
        }

        // fill_template gets a stricter sub-bucket on top of the global cap
        // already passed above. Block here surfaces `bucket: 'mcp:fill'`.
        let effectiveState: RateLimitState | null = globalState;
        if (toolName === TOOL_FILL_TEMPLATE) {
          const fillState = await checkRateLimit('mcp:fill', clientIp, readFillLimit());
          if (fillState.configured && !fillState.allowed) {
            const { result, retryAfterSec } = buildRateLimitedResult(body.id, TOOL_FILL_TEMPLATE, fillState);
            res.setHeader('Retry-After', String(retryAfterSec));
            logInfo({
              event: 'rate_limited',
              endpoint: 'mcp',
              bucket: 'mcp:fill',
              jsonrpcMethod: body.method,
              toolName,
              jsonrpcId: body.id,
              ...ctx,
            });
            return complete(200, false, trace, result);
          }
          effectiveState = combineState(globalState, fillState);
        }

        const toolResult = await handleToolsCall(body.id, params, ctx, effectiveState);
        const toolOk = !(toolResult as { result?: { error?: unknown } })?.result?.error;
        return complete(200, toolOk, trace, toolResult);
      }
      case 'ping':
        return complete(200, true, trace, jsonRpcResult(body.id, {}));
      default:
        return complete(200, false, trace, jsonRpcError(body.id, -32601, `Method not supported: "${body.method}"`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError({
      event: 'unhandled_exception',
      endpoint: 'mcp',
      jsonrpcMethod: body.method,
      toolName: requestedToolName,
      jsonrpcId: body.id,
      ...normalizeError(err),
      durationMs: Date.now() - startedAt,
      ...ctx,
    });
    // For tools/call, preserve the documented envelope contract even on
    // unexpected throws. Other methods keep the JSON-RPC protocol error.
    if (body.method === 'tools/call') {
      return complete(
        200,
        false,
        trace,
        toolErrorResult(
          body.id,
          requestedToolName ?? 'tools/call',
          ErrorCode.INTERNAL_ERROR,
          `Internal error: ${message}`,
          { retriable: false },
        ),
      );
    }
    return complete(200, false, trace, jsonRpcError(body.id, -32603, `Internal error: ${message}`));
  }
}
