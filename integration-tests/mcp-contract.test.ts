/**
 * Contract tests for MCP response envelopes and tool behaviors.
 */

import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure, allureJsonAttachment } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

const MOCK_TEMPLATE = {
  name: 'common-paper-mutual-nda',
  display_name: 'Common Paper Mutual NDA',
  category: 'confidentiality',
  description: 'Mutual NDA',
  license: 'CC-BY-4.0',
  source_url: 'https://commonpaper.com',
  source: 'Common Paper',
  attribution_text: 'Based on Common Paper Mutual NDA',
  fields: [
    {
      name: 'company_name',
      type: 'string',
      required: true,
      section: null,
      description: 'Company name',
      default: null,
    },
    {
      name: 'purpose',
      type: 'string',
      required: false,
      section: null,
      description: 'Purpose',
      default: null,
    },
  ],
};

const MOCK_LIST_RESULT = {
  cliVersion: '0.1.1',
  items: [MOCK_TEMPLATE],
};

const MOCK_FILL_SUCCESS = {
  ok: true as const,
  base64: Buffer.from('mock-docx-content').toString('base64'),
  metadata: {
    template: 'common-paper-mutual-nda',
    filledFieldCount: 1,
    totalFieldCount: 2,
    missingFields: ['purpose'],
    license: 'CC-BY-4.0',
    attribution: 'Based on Common Paper Mutual NDA',
  },
};

const MOCK_FILL_TEMPLATE_NOT_FOUND = {
  ok: false as const,
  error: 'Unknown template: "nonexistent"',
};

const VALID_DOWNLOAD_ID = 'validdownloadid00000000000000000000.mock-sig';

const handleListTemplatesMock = vi.fn(() => MOCK_LIST_RESULT);
const handleGetTemplateMock = vi.fn((templateId: string) => (
  templateId === MOCK_TEMPLATE.name ? MOCK_TEMPLATE : null
));
const handleFillMock = vi.fn(async (template: string) => (
  template === 'nonexistent' ? MOCK_FILL_TEMPLATE_NOT_FOUND : MOCK_FILL_SUCCESS
));
const createDownloadArtifactMock = vi.fn(() => ({
  download_id: VALID_DOWNLOAD_ID,
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  expires_at_ms: Date.now() + 3600000,
}));

const searchTemplatesMock = vi.fn((templates: unknown[], options: { query: string }) => {
  // Simple mock: return first template if query matches "nda", empty otherwise
  if (options.query.toLowerCase().includes('nda')) {
    const t = MOCK_TEMPLATE;
    return [{ template_id: t.name, display_name: t.display_name, category: t.category, description: t.description, source: t.source, field_count: t.fields.length, score: 5.0 }];
  }
  return [];
});

// Stand-ins for the typed download-store error hierarchy so `instanceof`
// checks in api/mcp.ts resolve against the mocked module.
class MockDownloadStoreUnavailableError extends Error {
  readonly cause_type: 'configuration' | 'runtime';
  constructor(message: string, cause_type: 'configuration' | 'runtime') {
    super(message);
    this.cause_type = cause_type;
  }
}
class MockDownloadStoreConfigurationError extends MockDownloadStoreUnavailableError {
  constructor(message: string) { super(message, 'configuration'); }
}
class MockDownloadStoreRuntimeError extends MockDownloadStoreUnavailableError {
  constructor(message: string) { super(message, 'runtime'); }
}

vi.mock('../api/_shared.js', () => ({
  handleListTemplates: handleListTemplatesMock,
  handleGetTemplate: handleGetTemplateMock,
  handleFill: handleFillMock,
  createDownloadArtifact: createDownloadArtifactMock,
  searchTemplates: searchTemplatesMock,
  DOCX_MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DownloadStoreUnavailableError: MockDownloadStoreUnavailableError,
  DownloadStoreConfigurationError: MockDownloadStoreConfigurationError,
  DownloadStoreRuntimeError: MockDownloadStoreRuntimeError,
  getDownloadStorageMode: () => 'memory',
}));

// Rate limiter is disabled by default in tests (returns `{ configured: false }`)
// so existing envelope assertions keep passing. Individual rate-limit tests
// override per-call via `checkRateLimitMock.mockResolvedValueOnce(...)`.
const checkRateLimitMock = vi.fn<
  (bucket: string, ip: string, limit: number) => Promise<unknown>
>(async () => ({ configured: false }));
vi.mock('../api/_ratelimit.js', async () => {
  const actual = await vi.importActual<typeof import('../api/_ratelimit.js')>('../api/_ratelimit.js');
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
  };
});

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  ended: boolean;
  setHeader: (k: string, v: string) => MockRes;
  status: (code: number) => MockRes;
  json: (data: unknown) => MockRes;
  send: (data: unknown) => MockRes;
  end: () => MockRes;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(k: string, v: string) { res.headers[k] = v; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.body = data; return res; },
    send(data: unknown) { res.body = data; return res; },
    end() { res.ended = true; return res; },
  };
  return res;
}

function createMockReq(overrides: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) {
  return {
    method: overrides.method ?? 'POST',
    headers: overrides.headers ?? { 'content-type': 'application/json', host: 'openagreements.ai' },
    body: overrides.body ?? {},
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getResultObject(res: MockRes): Record<string, unknown> {
  return asObject(asObject(res.body).result);
}

function parseEnvelope(body: unknown): Record<string, unknown> {
  const result = asObject(asObject(body).result);
  const content = Array.isArray(result.content) ? result.content : [];
  const first = content.length > 0 ? asObject(content[0]) : {};
  return JSON.parse(String(first.text ?? '{}')) as Record<string, unknown>;
}

const { default: mcpHandler } = await import('../api/mcp.js');

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('MCP contract envelope behaviors', () => {
  it.openspec('OA-DST-032')('returns a consistent success envelope shape for list_templates', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();

    await mcpHandler(req, res);

    const envelope = parseEnvelope(res.body);
    await allureJsonAttachment('mcp-contract-list-templates-success.json', envelope);

    expect(res.statusCode).toBe(200);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('list_templates');
    expect(envelope.schema_version).toBe('2026-02-19');
    expect(envelope.data.templates).toHaveLength(1);
    expect(envelope.data.rate_limit).toEqual({ limit: null, remaining: null, reset_at: null, bucket: null });
    expect(envelope.data.auth).toBeNull();
  });

  it.openspec('OA-DST-032')('returns compact and full list_templates payload modes', async () => {
    const compactReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: { mode: 'compact' } },
      },
    });
    const compactRes = createMockRes();
    await mcpHandler(compactReq, compactRes);

    const compactEnvelope = parseEnvelope(compactRes.body);
    expect(compactEnvelope.ok).toBe(true);
    expect(compactEnvelope.data.mode).toBe('compact');
    expect(compactEnvelope.data.templates[0]).toEqual({
      template_id: 'common-paper-mutual-nda',
      name: 'common-paper-mutual-nda',
      display_name: 'Common Paper Mutual NDA',
      field_count: 2,
    });

    const fullReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: { mode: 'full' } },
      },
    });
    const fullRes = createMockRes();
    await mcpHandler(fullReq, fullRes);

    const fullEnvelope = parseEnvelope(fullRes.body);
    expect(fullEnvelope.ok).toBe(true);
    expect(fullEnvelope.data.mode).toBe('full');
    expect(fullEnvelope.data.templates[0].template_id).toBe('common-paper-mutual-nda');
    expect(fullEnvelope.data.templates[0].fields).toHaveLength(2);
  });

  it.openspec('OA-DST-032')('returns get_template found and TEMPLATE_NOT_FOUND envelopes', async () => {
    const foundReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'get_template', arguments: { template_id: 'common-paper-mutual-nda' } },
      },
    });
    const foundRes = createMockRes();
    await mcpHandler(foundReq, foundRes);

    const foundEnvelope = parseEnvelope(foundRes.body);
    expect(foundEnvelope.ok).toBe(true);
    expect(foundEnvelope.tool).toBe('get_template');
    expect(foundEnvelope.data.template.template_id).toBe('common-paper-mutual-nda');

    const missingReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'get_template', arguments: { template_id: 'does-not-exist' } },
      },
    });
    const missingRes = createMockRes();
    await mcpHandler(missingReq, missingRes);

    const missingEnvelope = parseEnvelope(missingRes.body);
    expect(getResultObject(missingRes).isError).toBe(true);
    expect(missingEnvelope.ok).toBe(false);
    expect(missingEnvelope.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it.openspec('OA-DST-032')('returns fill_template envelopes for url and mcp_resource', async () => {
    const urlReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            values: { company_name: 'Acme Corp' },
            return_mode: 'url',
          },
        },
      },
    });
    const urlRes = createMockRes();
    await mcpHandler(urlReq, urlRes);

    const urlEnvelope = parseEnvelope(urlRes.body);
    expect(urlEnvelope.ok).toBe(true);
    expect(urlEnvelope.data.return_mode).toBe('url');
    expect(urlEnvelope.data.download_url).toContain('/api/download?id=');
    expect(urlEnvelope.data.download_id).toBe(VALID_DOWNLOAD_ID);

    const resourceReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            values: { company_name: 'Acme Corp' },
            return_mode: 'mcp_resource',
          },
        },
      },
    });
    const resourceRes = createMockRes();
    await mcpHandler(resourceReq, resourceRes);

    const resourceEnvelope = parseEnvelope(resourceRes.body);
    expect(resourceEnvelope.ok).toBe(true);
    expect(resourceEnvelope.data.return_mode).toBe('mcp_resource');
    expect(resourceEnvelope.data.resource_uri).toBe(`oa://filled/${VALID_DOWNLOAD_ID}`);
    expect(resourceEnvelope.data.download_url).toContain('/api/download?id=');
  });

  it.openspec('OA-DST-032')('returns INVALID_ARGUMENT for removed/invalid arguments and unknown tool', async () => {
    const invalidArgReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            return_mode: 'base64_docx',
          },
        },
      },
    });
    const invalidArgRes = createMockRes();
    await mcpHandler(invalidArgReq, invalidArgRes);

    const invalidArgEnvelope = parseEnvelope(invalidArgRes.body);
    expect(invalidArgEnvelope.ok).toBe(false);
    expect(invalidArgEnvelope.error.code).toBe('INVALID_ARGUMENT');
    expect(invalidArgEnvelope.error.details.issues.length).toBeGreaterThan(0);

    const unknownToolReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: { name: 'not_a_tool', arguments: {} },
      },
    });
    const unknownToolRes = createMockRes();
    await mcpHandler(unknownToolReq, unknownToolRes);

    const unknownToolEnvelope = parseEnvelope(unknownToolRes.body);
    expect(unknownToolEnvelope.ok).toBe(false);
    expect(unknownToolEnvelope.error.code).toBe('INVALID_ARGUMENT');
  });

  it.openspec('OA-DST-032')('returns HTML for browser GET and 405 for non-browser GET', async () => {
    const browserReq = createMockReq({ method: 'GET', headers: { accept: 'text/html' } });
    const browserRes = createMockRes();
    await mcpHandler(browserReq, browserRes);

    expect(browserRes.statusCode).toBe(200);
    expect(browserRes.headers['Content-Type']).toContain('text/html');
    expect(String(browserRes.body)).toContain('OpenAgreements MCP endpoint');

    const nonBrowserReq = createMockReq({ method: 'GET', headers: { accept: 'application/json' } });
    const nonBrowserRes = createMockRes();
    await mcpHandler(nonBrowserReq, nonBrowserRes);

    expect(nonBrowserRes.statusCode).toBe(405);
    expect(String(asObject(nonBrowserRes.body).error)).toContain('Only POST');
  });

  it.openspec('OA-DST-032')('search_templates appears in tools/list', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 20, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const body = asObject(res.body);
    const result = asObject(body.result);
    const tools = Array.isArray(result.tools) ? result.tools : [];
    const toolNames = tools.map((t: Record<string, unknown>) => t.name);
    expect(toolNames).toContain('search_templates');
  });

  it.openspec('OA-DST-032')('tools/list omits signing tools when DocuSign is not configured', async () => {
    vi.stubEnv('OA_DOCUSIGN_INTEGRATION_KEY', '');
    vi.stubEnv('OA_DOCUSIGN_SECRET_KEY', '');
    vi.stubEnv('OA_GCLOUD_ENCRYPTION_KEY', '');

    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 30, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const body = asObject(res.body);
    const result = asObject(body.result);
    const tools = Array.isArray(result.tools) ? result.tools : [];
    const toolNames = tools.map((t: Record<string, unknown>) => t.name);

    expect(toolNames).not.toContain('send_for_signature');
    expect(toolNames).not.toContain('check_signature_status');
    // Template tools remain available regardless of signing config.
    expect(toolNames).toContain('search_templates');
    expect(toolNames).toContain('list_templates');
  });

  it.openspec('OA-DST-032')('tools/list includes signing tools when DocuSign is configured', async () => {
    vi.stubEnv('OA_DOCUSIGN_INTEGRATION_KEY', 'test-integration-key');
    vi.stubEnv('OA_DOCUSIGN_SECRET_KEY', 'test-secret-key');
    vi.stubEnv('OA_GCLOUD_ENCRYPTION_KEY', 'deadbeef');

    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 31, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const body = asObject(res.body);
    const result = asObject(body.result);
    const tools = Array.isArray(result.tools) ? result.tools : [];
    const toolNames = tools.map((t: Record<string, unknown>) => t.name);

    expect(toolNames).toContain('send_for_signature');
    expect(toolNames).toContain('check_signature_status');
  });

  it.openspec('OA-DST-032')('signing tools/call returns 401 when unauthenticated, even with signing not configured', async () => {
    // Documents the auth-fires-first invariant: AUTH_REQUIRED_TOOLS is enforced
    // before handleSigningToolCall, so an unauthenticated stale client invoking
    // a hidden signing tool sees an auth challenge rather than a
    // signing-not-configured envelope. The list is not a security boundary.
    vi.stubEnv('OA_DOCUSIGN_INTEGRATION_KEY', '');
    vi.stubEnv('OA_DOCUSIGN_SECRET_KEY', '');
    vi.stubEnv('OA_GCLOUD_ENCRYPTION_KEY', '');

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 33,
        method: 'tools/call',
        params: { name: 'send_for_signature', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(401);
    const body = asObject(res.body);
    const error = asObject(body.error);
    expect(error.code).toBe(-32001);
  });

  it.openspec('OA-DST-032')('unknown tools/call omits signing tools from available_tools when DocuSign is not configured', async () => {
    vi.stubEnv('OA_DOCUSIGN_INTEGRATION_KEY', '');
    vi.stubEnv('OA_DOCUSIGN_SECRET_KEY', '');
    vi.stubEnv('OA_GCLOUD_ENCRYPTION_KEY', '');

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 32,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    const error = asObject(envelope.error);
    const details = asObject(error.details);
    const available = Array.isArray(details.available_tools) ? details.available_tools : [];

    expect(available).not.toContain('send_for_signature');
    expect(available).not.toContain('check_signature_status');
    expect(available).toContain('search_templates');
  });

  it.openspec('OA-DST-032')('search_templates returns success envelope for valid query', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: { name: 'search_templates', arguments: { query: 'nda' } },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('search_templates');
    expect(envelope.data.query).toBe('nda');
    expect(envelope.data.result_count).toBe(1);
    expect(Array.isArray(envelope.data.results)).toBe(true);
    expect(envelope.data.results[0].template_id).toBe('common-paper-mutual-nda');
    expect(envelope.data.results[0].display_name).toBe('Common Paper Mutual NDA');
    expect(envelope.data.results[0].score).toBeGreaterThan(0);
  });

  it.openspec('OA-DST-032')('search_templates returns INVALID_ARGUMENT for missing query', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 22,
        method: 'tools/call',
        params: { name: 'search_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_ARGUMENT');
  });

  it.openspec('OA-DST-032')('list_templates full mode includes display_name', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 23,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: { mode: 'full' } },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.templates[0].display_name).toBe('Common Paper Mutual NDA');
  });

  // Regression coverage for issue #197: unhandled runtime exceptions in
  // fill/download paths must still produce the v2 envelope, not a raw
  // JSON-RPC -32603.
  it.openspec('OA-DST-032')('returns INTERNAL_ERROR envelope when handleFill throws', async () => {
    handleFillMock.mockRejectedValueOnce(new Error('render engine crashed'));

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 30,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            values: { company_name: 'Acme Corp' },
          },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getResultObject(res).isError).toBe(true);
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.tool).toBe('fill_template');
    expect(envelope.schema_version).toBe('2026-02-19');
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.retriable).toBe(false);
    expect(envelope.error.message).toContain('Fill failed');
    expect(envelope.error.message).toContain('render engine crashed');
  });

  it.openspec('OA-DST-032')('returns INTERNAL_ERROR envelope when createDownloadArtifact throws', async () => {
    createDownloadArtifactMock.mockImplementationOnce(() => {
      throw new Error('download store unavailable');
    });

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 31,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            values: { company_name: 'Acme Corp' },
          },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getResultObject(res).isError).toBe(true);
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.tool).toBe('fill_template');
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.retriable).toBe(false);
    expect(envelope.error.message).toContain('Download artifact creation failed');
    expect(envelope.error.message).toContain('download store unavailable');
  });

  it.openspec('OA-DST-032')('outer safety-net: returns INTERNAL_ERROR envelope when a non-fill tool handler throws', async () => {
    handleGetTemplateMock.mockImplementationOnce(() => {
      throw new Error('catalog corruption');
    });

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 32,
        method: 'tools/call',
        params: {
          name: 'get_template',
          arguments: { template_id: 'common-paper-mutual-nda' },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    // Outer catch routes through toolErrorResult, which sets isError on the result.
    expect(getResultObject(res).isError).toBe(true);
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.tool).toBe('get_template');
    expect(envelope.schema_version).toBe('2026-02-19');
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.retriable).toBe(false);
    expect(envelope.error.message).toContain('catalog corruption');
  });
});

describe('MCP structured logging', () => {
  type LogCall = Record<string, unknown>;

  function captureLogs() {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const parsed = (spy: ReturnType<typeof vi.spyOn>): LogCall[] =>
      spy.mock.calls
        .map((call) => {
          try {
            return JSON.parse(String(call[0])) as LogCall;
          } catch {
            return null;
          }
        })
        .filter((value): value is LogCall => value !== null);
    return {
      infoLogs: () => parsed(infoSpy),
      errorLogs: () => parsed(errorSpy),
      allRaw: () => JSON.stringify([...infoSpy.mock.calls, ...errorSpy.mock.calls]),
      restore: () => {
        infoSpy.mockRestore();
        errorSpy.mockRestore();
      },
    };
  }

  it.openspec('OA-DST-038')('propagates x-vercel-id into request_start and request_complete', async () => {
    const cap = captureLogs();
    const req = createMockReq({
      headers: {
        'content-type': 'application/json',
        host: 'openagreements.ai',
        'x-vercel-id': 'fra1::abc123',
      },
      body: { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const start = cap.infoLogs().find((l) => l.event === 'request_start');
    const done = cap.infoLogs().find((l) => l.event === 'request_complete');

    expect(start).toMatchObject({
      event: 'request_start',
      endpoint: 'mcp',
      level: 'info',
      vercelId: 'fra1::abc123',
      jsonrpcMethod: 'tools/list',
      jsonrpcId: 7,
    });
    expect(done).toMatchObject({
      event: 'request_complete',
      endpoint: 'mcp',
      vercelId: 'fra1::abc123',
      ok: true,
      status: 200,
    });
    expect(typeof done?.durationMs).toBe('number');
    cap.restore();
  });

  it.openspec('OA-DST-039')('propagates vercelId and normalizes err in tool_internal_error', async () => {
    handleFillMock.mockImplementationOnce(async () => {
      throw new Error('synthetic fill failure');
    });
    const cap = captureLogs();
    const req = createMockReq({
      headers: {
        'content-type': 'application/json',
        host: 'openagreements.ai',
        'x-vercel-id': 'iad1::xyz789',
      },
      body: {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: { template: 'common-paper-mutual-nda', values: { company_name: 'Acme' } },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const errLog = cap.errorLogs().find((l) => l.event === 'tool_internal_error');
    expect(errLog).toMatchObject({
      event: 'tool_internal_error',
      endpoint: 'mcp',
      level: 'error',
      vercelId: 'iad1::xyz789',
      tool: 'fill_template',
      phase: 'fill',
      jsonrpcId: 11,
      name: 'Error',
      message: 'synthetic fill failure',
    });
    expect(typeof errLog?.stack).toBe('string');
    cap.restore();
  });

  it.openspec('OA-DST-040')('redacts bearer token to a fingerprint on auth_denied', async () => {
    const cap = captureLogs();
    const rawToken = 'super-secret-bearer-zzz-do-not-leak';
    const req = createMockReq({
      headers: {
        'content-type': 'application/json',
        host: 'openagreements.ai',
        authorization: `Bearer ${rawToken}`,
      },
      body: {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'send_for_signature',
          arguments: {},
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const denied = cap.errorLogs().find((l) => l.event === 'auth_denied');
    expect(denied).toBeDefined();
    expect(denied).toMatchObject({
      event: 'auth_denied',
      endpoint: 'mcp',
      toolName: 'send_for_signature',
    });
    expect(String(denied?.tokenFp)).toMatch(/^[0-9a-f]{12}$/);

    // Critical: the raw bearer token must never appear in any captured log.
    expect(cap.allRaw()).not.toContain(rawToken);
    cap.restore();
  });

  it.openspec('OA-DST-041')('does not fingerprint bearer tokens on non-auth-required successful paths', async () => {
    const cap = captureLogs();
    const req = createMockReq({
      headers: {
        'content-type': 'application/json',
        host: 'openagreements.ai',
        // list_templates is not in AUTH_REQUIRED_TOOLS — verifyAuth is never called.
        authorization: 'Bearer harmless-but-should-not-be-logged',
      },
      body: { jsonrpc: '2.0', id: 13, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const all = [...cap.infoLogs(), ...cap.errorLogs()];
    expect(all.find((l) => l.event === 'request_complete')?.ok).toBe(true);
    // No log should carry tokenFp on a non-auth-required path.
    expect(all.some((l) => 'tokenFp' in l)).toBe(false);
    cap.restore();
  });

  it.openspec('OA-DST-042')('logs request_rejected_invalid_jsonrpc when envelope is malformed', async () => {
    const cap = captureLogs();
    const req = createMockReq({
      body: { id: 14, method: 'tools/list' /* jsonrpc field missing */ },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const rejected = cap.errorLogs().find((l) => l.event === 'request_rejected_invalid_jsonrpc');
    expect(rejected).toMatchObject({
      event: 'request_rejected_invalid_jsonrpc',
      endpoint: 'mcp',
      level: 'error',
      status: 400,
      jsonrpcId: 14,
    });
    expect(res.statusCode).toBe(400);
    cap.restore();
  });

  it.openspec('OA-DST-043')('omits vercelId entirely when x-vercel-id header is absent', async () => {
    const cap = captureLogs();
    const req = createMockReq({
      // No x-vercel-id header.
      headers: { 'content-type': 'application/json', host: 'openagreements.ai' },
      body: { jsonrpc: '2.0', id: 15, method: 'tools/list', params: {} },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const start = cap.infoLogs().find((l) => l.event === 'request_start');
    expect(start).toBeDefined();
    // The key must be absent — not undefined, not null, not a synthetic id.
    expect('vercelId' in (start as object)).toBe(false);

    const done = cap.infoLogs().find((l) => l.event === 'request_complete');
    expect('vercelId' in (done as object)).toBe(false);
    cap.restore();
  });
});

describe('MCP rate limiting', () => {
  it.openspec('OA-DST-044')('reports truthful rate_limit metadata when limiter is active', async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      configured: true,
      allowed: true,
      bucket: 'mcp:global',
      limit: 600,
      remaining: 599,
      reset_at: '2026-04-24T00:01:00.000Z',
    });

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.rate_limit).toEqual({
      limit: 600,
      remaining: 599,
      reset_at: '2026-04-24T00:01:00.000Z',
      bucket: 'mcp:global',
    });
  });

  it.openspec('OA-DST-045')('blocks tools/call with RATE_LIMITED envelope and Retry-After header on global cap', async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    checkRateLimitMock.mockResolvedValueOnce({
      configured: true,
      allowed: false,
      bucket: 'mcp:global',
      limit: 600,
      remaining: 0,
      reset_at: resetAt,
    });

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Retry-After']).toBeDefined();
    const retryAfterSec = Number(res.headers['Retry-After']);
    expect(retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(retryAfterSec).toBeLessThanOrEqual(30);

    const envelope = parseEnvelope(res.body);
    expect(getResultObject(res).isError).toBe(true);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('RATE_LIMITED');
    expect(envelope.error.retriable).toBe(true);
    expect(envelope.error.details.rate_limit).toEqual({
      limit: 600,
      remaining: 0,
      reset_at: resetAt,
      bucket: 'mcp:global',
    });
  });

  it.openspec('OA-DST-046')('enforces stricter mcp:fill bucket when global passes', async () => {
    const fillResetAt = new Date(Date.now() + 45_000).toISOString();
    // Global bucket: allowed. Fill bucket: blocked.
    checkRateLimitMock
      .mockResolvedValueOnce({
        configured: true,
        allowed: true,
        bucket: 'mcp:global',
        limit: 600,
        remaining: 500,
        reset_at: '2026-04-24T00:01:00.000Z',
      })
      .mockResolvedValueOnce({
        configured: true,
        allowed: false,
        bucket: 'mcp:fill',
        limit: 120,
        remaining: 0,
        reset_at: fillResetAt,
      });

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: { template: 'common-paper-mutual-nda', values: { company_name: 'Acme' } },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(checkRateLimitMock).toHaveBeenCalledTimes(2);
    expect(checkRateLimitMock.mock.calls[0][0]).toBe('mcp:global');
    expect(checkRateLimitMock.mock.calls[1][0]).toBe('mcp:fill');

    expect(res.statusCode).toBe(200);
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.tool).toBe('fill_template');
    expect(envelope.error.code).toBe('RATE_LIMITED');
    expect(envelope.error.details.rate_limit.bucket).toBe('mcp:fill');
  });

  it.openspec('OA-DST-047')('counts JSON-RPC notifications against the global bucket', async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      configured: true,
      allowed: true,
      bucket: 'mcp:global',
      limit: 600,
      remaining: 598,
      reset_at: '2026-04-24T00:01:00.000Z',
    });

    const req = createMockReq({
      body: { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
      // No id — this is a notification.
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    // Limiter must have been consulted before the notification short-circuit.
    expect(checkRateLimitMock).toHaveBeenCalledWith('mcp:global', expect.any(String), expect.any(Number));
    // Notification still returns 202 when allowed.
    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-DST-048')('fails open with null rate_limit metadata when limiter is unconfigured', async () => {
    // Default mock returns { configured: false } — emulates dev/test or runtime fail-open.
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 103,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Retry-After']).toBeUndefined();
    const envelope = parseEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.rate_limit).toEqual({
      limit: null,
      remaining: null,
      reset_at: null,
      bucket: null,
    });
  });
});
