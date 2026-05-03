/**
 * Handler-level tests for the A2A, MCP, and download Vercel endpoints.
 * Mocks the shared business logic so tests exercise only the protocol routing.
 */

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure, allureStep, allureJsonAttachment } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

// ---------------------------------------------------------------------------
// Mock shared business logic
// ---------------------------------------------------------------------------

const MOCK_LIST_RESULT = {
  cliVersion: '0.1.1',
  items: [
    {
      name: 'common-paper-mutual-nda',
      category: 'general',
      description: 'Mutual NDA',
      license: 'CC-BY-4.0',
      source_url: 'https://commonpaper.com',
      source: 'Common Paper',
      fields: [
        { name: 'company_name', type: 'string', required: true, section: null, description: 'Company name', default: null },
      ],
    },
  ],
};

const MOCK_FILL_SUCCESS = {
  ok: true as const,
  base64: Buffer.from('mock-docx-content').toString('base64'),
  metadata: {
    template: 'common-paper-mutual-nda',
    filledFieldCount: 1,
    totalFieldCount: 3,
    missingFields: ['purpose', 'effective_date'],
    license: 'CC-BY-4.0',
    attribution: 'Based on Common Paper Mutual NDA',
  },
};

const MOCK_FILL_FAILURE = {
  ok: false as const,
  error: 'Unknown template: "nonexistent"',
};

const handleFillMock = vi.fn();
const handleListTemplatesMock = vi.fn(() => MOCK_LIST_RESULT);
const handleGetTemplateMock = vi.fn(() => MOCK_LIST_RESULT.items[0]);
const createDownloadArtifactMock = vi.fn(() => ({
  download_id: 'mock-download-id.mock-sig',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  expires_at_ms: Date.now() + 3600000,
}));
const resolveDownloadArtifactMock = vi.fn();
const generateRedlineFromFillMock = vi.fn();
const getDownloadStorageModeMock = vi.fn<[], string | null>(() => 'memory');

// Minimal stand-ins for the typed error hierarchy so `instanceof` checks in
// download.ts and mcp.ts work against the mocked module.
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
  handleFill: handleFillMock,
  handleListTemplates: handleListTemplatesMock,
  handleGetTemplate: handleGetTemplateMock,
  createDownloadArtifact: createDownloadArtifactMock,
  resolveDownloadArtifact: resolveDownloadArtifactMock,
  generateRedlineFromFill: generateRedlineFromFillMock,
  DOCX_MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PROJECT_ROOT: '/mock',
  DownloadStoreUnavailableError: MockDownloadStoreUnavailableError,
  DownloadStoreConfigurationError: MockDownloadStoreConfigurationError,
  DownloadStoreRuntimeError: MockDownloadStoreRuntimeError,
  getDownloadStorageMode: getDownloadStorageModeMock,
}));

// ---------------------------------------------------------------------------
// Helpers — mock Vercel req/res
// ---------------------------------------------------------------------------

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
  query?: Record<string, string>;
} = {}) {
  return {
    method: overrides.method ?? 'POST',
    headers: overrides.headers ?? { 'content-type': 'application/json' },
    body: overrides.body ?? {},
    query: overrides.query ?? {},
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getResultObject(res: MockRes): Record<string, unknown> {
  return asObject(asObject(res.body).result);
}

function getErrorObject(res: MockRes): Record<string, unknown> {
  return asObject(asObject(res.body).error);
}

function parseMcpEnvelope(body: unknown): Record<string, unknown> {
  const result = asObject(asObject(body).result);
  const content = Array.isArray(result.content) ? result.content : [];
  const first = content.length > 0 ? asObject(content[0]) : {};
  return JSON.parse(String(first.text ?? '{}')) as Record<string, unknown>;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// A2A endpoint tests
// ---------------------------------------------------------------------------

const { default: a2aHandler } = await import('../api/a2a.js');

describe('A2A endpoint — api/a2a.ts', () => {
  it.openspec('OA-DST-022')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it.openspec('OA-DST-022')('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it.openspec('OA-DST-022')('returns JSON-RPC error for invalid request body', async () => {
    const req = createMockReq({ body: { notJsonRpc: true } });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getErrorObject(res).code).toBe(-32600);
  });

  it.openspec('OA-DST-022')('returns JSON-RPC error for unsupported methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 1, method: 'tasks/get' },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getErrorObject(res).code).toBe(-32601);
    expect(String(getErrorObject(res).message)).toContain('tasks/get');
  });

  it.openspec('OA-DST-022')('routes list-templates skill to handleListTemplates', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          message: {
            parts: [{ type: 'data', data: { skill: 'list-templates' } }],
          },
        },
      },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    await allureJsonAttachment('a2a-list-response.json', res.body);

    expect(res.statusCode).toBe(200);
    expect(handleListTemplatesMock).toHaveBeenCalledTimes(1);
    const result = getResultObject(res);
    expect(result.status.state).toBe('completed');
    expect(result.artifacts[0].parts[0].data.items).toHaveLength(1);
  });

  it.openspec('OA-DST-022')('routes fill-template skill to handleFill', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'message/send',
        params: {
          message: {
            parts: [
              {
                type: 'data',
                data: {
                  skill: 'fill-template',
                  template: 'common-paper-mutual-nda',
                  values: { company_name: 'Acme Corp' },
                },
              },
            ],
          },
        },
      },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    await allureJsonAttachment('a2a-fill-response.json', res.body);

    expect(res.statusCode).toBe(200);
    expect(handleFillMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });
    const result = getResultObject(res);
    expect(result.status.state).toBe('completed');
    expect(result.artifacts[0].parts[0].data.inlineData).toBe(MOCK_FILL_SUCCESS.base64);
  });

  it.openspec('OA-DST-022')('returns failed status when handleFill fails', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_FAILURE);

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'message/send',
        params: {
          message: {
            parts: [{ type: 'data', data: { skill: 'fill-template', template: 'nonexistent' } }],
          },
        },
      },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    const result = getResultObject(res);
    expect(result.status.state).toBe('failed');
    expect(result.status.message).toContain('nonexistent');
  });

  it.openspec('OA-DST-022')('returns error for unknown skill', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 4,
        method: 'message/send',
        params: {
          message: {
            parts: [{ type: 'data', data: { skill: 'unknown-skill' } }],
          },
        },
      },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(String(getErrorObject(res).message)).toContain('unknown-skill');
  });

  it.openspec('OA-DST-022')('returns error when message parts are missing', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'message/send',
        params: { message: {} },
      },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(getErrorObject(res).code).toBe(-32602);
  });
});

// ---------------------------------------------------------------------------
// MCP endpoint tests
// ---------------------------------------------------------------------------

const { default: mcpHandler } = await import('../api/mcp.js');

describe('MCP endpoint — api/mcp.ts', () => {
  it.openspec('OA-DST-023')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Mcp-Session-Id');
  });

  it.openspec('OA-DST-023')('returns 405 JSON for non-browser GET requests', async () => {
    const req = createMockReq({ method: 'GET', headers: { accept: 'application/json' } });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(405);
    expect(String(asObject(res.body).error)).toContain('Only POST');
  });

  it.openspec('OA-DST-023')('returns 200 HTML for browser-style GET requests', async () => {
    const req = createMockReq({ method: 'GET', headers: { accept: 'text/html' } });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(typeof res.body).toBe('string');
    expect(String(res.body)).toContain('OpenAgreements MCP endpoint');
  });

  it.openspec('OA-DST-023')('handles initialize handshake', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    await allureJsonAttachment('mcp-initialize-response.json', res.body);

    expect(res.statusCode).toBe(200);
    const result = getResultObject(res);
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.serverInfo.name).toBe('OpenAgreements');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
    expect(result.serverInfo.version).toBe(pkg.version);
    expect(result.capabilities.tools).toBeDefined();
  });

  it.openspec('OA-DST-023')('returns 202 for notifications (no id)', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-DST-024')('handles tools/list', async () => {
    // Advertise the full tool surface (signing gated on DocuSign config — see #201).
    vi.stubEnv('OA_DOCUSIGN_INTEGRATION_KEY', 'test-integration-key');
    vi.stubEnv('OA_DOCUSIGN_SECRET_KEY', 'test-secret-key');
    vi.stubEnv('OA_GCLOUD_ENCRYPTION_KEY', 'deadbeef');

    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    await allureJsonAttachment('mcp-tools-list.json', res.body);

    const tools = getResultObject(res).tools;
    // connect_signing_provider and disconnect_signing_provider removed from remote MCP
    // (signing auth now handled via MCP-native OAuth, not tool-based)
    expect(tools).toHaveLength(6);
    expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'check_signature_status',
      'fill_template',
      'get_template',
      'list_templates',
      'search_templates',
      'send_for_signature',
    ]);

    // Descriptor must advertise the same default the Zod schema enforces.
    const listTemplates = tools.find((t: { name: string }) => t.name === 'list_templates');
    expect(listTemplates.inputSchema.properties.mode.description).toContain('Defaults to "compact"');
  });

  it.openspec('OA-DST-024')('handles tools/call list_templates with envelope response', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(handleListTemplatesMock).toHaveBeenCalledTimes(1);
    const envelope = parseMcpEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('list_templates');
    expect(envelope.schema_version).toBe('2026-02-19');
    expect(envelope.data.mode).toBe('compact');
    expect(envelope.data.templates).toHaveLength(1);
    expect(envelope.data.rate_limit).toBeDefined();
  });

  it.openspec('OA-DST-024')('handles tools/call get_template', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 31,
        method: 'tools/call',
        params: {
          name: 'get_template',
          arguments: { template_id: 'common-paper-mutual-nda' },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(handleGetTemplateMock).toHaveBeenCalledWith('common-paper-mutual-nda');
    const envelope = parseMcpEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('get_template');
    expect(envelope.data.template.template_id).toBe('common-paper-mutual-nda');
  });

  it.openspec('OA-DST-017')('handles tools/call fill_template with URL return_mode envelope', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({
      headers: { 'content-type': 'application/json', host: 'openagreements.org' },
      body: {
        jsonrpc: '2.0',
        id: 4,
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

    await allureJsonAttachment('mcp-fill-response.json', res.body);

    expect(handleFillMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });
    expect(createDownloadArtifactMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });

    const envelope = parseMcpEnvelope(res.body);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('fill_template');
    expect(envelope.data.return_mode).toBe('url');
    expect(envelope.data.download_url).toContain('/api/download?id=');
    expect(envelope.data.download_id).toBe('mock-download-id.mock-sig');
    expect(envelope.data.expires_at).toBeDefined();
    expect(envelope.data.rate_limit).toBeDefined();
  });

  it.openspec('OA-DST-024')('returns INVALID_ARGUMENT envelope for fill_template with missing template arg', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'fill_template', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const result = getResultObject(res);
    const envelope = parseMcpEnvelope(res.body);
    expect(result.isError).toBe(true);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_ARGUMENT');
    expect(envelope.error.details.issues.length).toBeGreaterThan(0);
  });

  it.openspec('OA-DST-024')('returns TEMPLATE_NOT_FOUND envelope for fill_template when handleFill fails', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_FAILURE);

    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'fill_template', arguments: { template: 'nonexistent' } },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const result = getResultObject(res);
    const envelope = parseMcpEnvelope(res.body);
    expect(result.isError).toBe(true);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('TEMPLATE_NOT_FOUND');
    expect(envelope.error.message).toContain('nonexistent');
  });

  it.openspec('OA-DST-036')('returns INTERNAL_ERROR with DOWNLOAD_STORE_UNAVAILABLE details when createDownloadArtifact fails (configuration)', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);
    createDownloadArtifactMock.mockImplementationOnce(() => {
      throw new MockDownloadStoreConfigurationError('KV not configured');
    });

    const req = createMockReq({
      headers: { 'content-type': 'application/json', host: 'openagreements.org' },
      body: {
        jsonrpc: '2.0',
        id: 70,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: { template: 'common-paper-mutual-nda', values: {} },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const result = getResultObject(res);
    const envelope = parseMcpEnvelope(res.body);
    expect(result.isError).toBe(true);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.retriable).toBe(false);
    expect(envelope.error.details).toMatchObject({
      reason: 'DOWNLOAD_STORE_UNAVAILABLE',
      cause: 'configuration',
    });
  });

  it.openspec('OA-DST-036')('returns retriable INTERNAL_ERROR when createDownloadArtifact fails (runtime)', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);
    createDownloadArtifactMock.mockImplementationOnce(() => {
      throw new MockDownloadStoreRuntimeError('upstash 5xx');
    });

    const req = createMockReq({
      headers: { 'content-type': 'application/json', host: 'openagreements.org' },
      body: {
        jsonrpc: '2.0',
        id: 71,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: { template: 'common-paper-mutual-nda', values: {} },
        },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const envelope = parseMcpEnvelope(res.body);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.retriable).toBe(true);
    expect(envelope.error.details).toMatchObject({
      reason: 'DOWNLOAD_STORE_UNAVAILABLE',
      cause: 'runtime',
    });
  });

  it.openspec('OA-DST-024')('returns INVALID_ARGUMENT envelope for unknown tool name', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'unknown_tool', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    const result = getResultObject(res);
    const envelope = parseMcpEnvelope(res.body);
    expect(result.isError).toBe(true);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('INVALID_ARGUMENT');
    expect(envelope.error.message).toContain('unknown_tool');
  });

  it.openspec('OA-DST-023')('responds to ping', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 8, method: 'ping' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getResultObject(res)).toEqual({});
  });

  it.openspec('OA-DST-023')('returns method-not-supported for unknown methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 9, method: 'resources/list' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(getErrorObject(res).code).toBe(-32601);
  });

  it.openspec('OA-DST-023')('returns 400 for invalid JSON-RPC body', async () => {
    const req = createMockReq({ body: { not: 'jsonrpc' } });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Download endpoint tests
// ---------------------------------------------------------------------------

const { default: downloadHandler } = await import('../api/download.js');

describe('Download endpoint — api/download.ts', () => {
  it.openspec('OA-DST-025')('returns 405 for non-GET/HEAD methods', async () => {
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it.openspec('OA-DST-025')('returns 400 with machine-readable code when id is missing', async () => {
    const req = createMockReq({ method: 'GET', query: {} });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_ID_MISSING');
    expect(String(getErrorObject(res).message)).toContain('"id"');
  });

  it.openspec('OA-DST-020')('returns 403 with machine-readable code for invalid signature', async () => {
    resolveDownloadArtifactMock.mockReturnValue({ ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' });

    const req = createMockReq({ method: 'GET', query: { id: 'bad-download-id' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_SIGNATURE_INVALID');
  });

  it.openspec('OA-DST-025')('renders a user-facing HTML error page when browser clients request text/html', async () => {
    resolveDownloadArtifactMock.mockReturnValue({ ok: false, code: 'DOWNLOAD_EXPIRED' });

    const req = createMockReq({
      method: 'GET',
      query: { id: 'expired-id.valid-sig' },
      headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(typeof res.body).toBe('string');
    expect(String(res.body)).toContain('Download Link Unavailable');
    expect(String(res.body)).toContain('DOWNLOAD_EXPIRED');
  });

  it.openspec('OA-DST-018')('serves DOCX for valid download_id', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    await allureJsonAttachment('download-response-headers.json', res.headers);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('wordprocessingml.document');
    expect(res.headers['Content-Disposition']).toContain('common-paper-mutual-nda.docx');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it.openspec('OA-DST-025')('returns 500 with machine-readable code when fill fails for a valid id', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'nonexistent',
        values: {},
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_FAILURE);

    const req = createMockReq({ method: 'GET', query: { id: 'valid-but-bad-template' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_RENDER_FAILED');
    expect(String(getErrorObject(res).message)).toContain('nonexistent');
  });

  it.openspec('OA-DST-019')('supports HEAD for valid download_id without response body', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({ method: 'HEAD', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-DST-021')('supports HEAD error probing with status parity', async () => {
    resolveDownloadArtifactMock.mockReturnValue({ ok: false, code: 'DOWNLOAD_EXPIRED' });

    const req = createMockReq({ method: 'HEAD', query: { id: 'expired-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.headers['X-Download-Error-Code']).toBe('DOWNLOAD_EXPIRED');
    expect(res.body).toBeUndefined();
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-DST-025')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(204);
  });

  // Regression coverage for issue #197: unhandled throws in the download
  // render path must return DOWNLOAD_RENDER_FAILED with a generic message
  // (no err.message leak into the browser-visible body).
  it.openspec('OA-DST-025')('returns DOWNLOAD_RENDER_FAILED (generic message) when generateRedlineFromFill throws', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        variant: 'redline',
        redline_base: 'source',
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);
    generateRedlineFromFillMock.mockRejectedValueOnce(new Error('sensitive internal details'));

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_RENDER_FAILED');
    expect(getErrorObject(res).message).toBe('Redline generation failed.');
    // err.message must not leak into the response body
    expect(JSON.stringify(res.body)).not.toContain('sensitive internal details');
  });

  it.openspec('OA-DST-025')('returns DOWNLOAD_RENDER_FAILED (generic message) when handleFill throws', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockRejectedValueOnce(new Error('sensitive fill trace'));

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_RENDER_FAILED');
    expect(getErrorObject(res).message).toBe('Template render failed.');
    expect(JSON.stringify(res.body)).not.toContain('sensitive fill trace');
  });

  // Follow-up to #197 (#206): close the residual uncaught surfaces before
  // the existing handleFill catch and around buffer/response assembly.
  it.openspec('OA-DST-025')('returns DOWNLOAD_RENDER_FAILED when resolveDownloadArtifact throws (e.g. KV outage)', async () => {
    resolveDownloadArtifactMock.mockImplementationOnce(() => {
      throw new Error('upstash unreachable');
    });

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_RENDER_FAILED');
    expect(getErrorObject(res).message).toBe('Download lookup failed.');
    expect(JSON.stringify(res.body)).not.toContain('upstash unreachable');
  });

  it.openspec('OA-DST-025')('returns DOWNLOAD_RENDER_FAILED when Buffer assembly throws on malformed base64', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    // Force the response-assembly path to throw via a setHeader stub.
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    let triggered = false;
    res.setHeader = ((k: string, v: string) => {
      if (k === 'Content-Length' && !triggered) {
        triggered = true;
        throw new Error('header write failed');
      }
      res.headers[k] = v;
      return res;
    }) as MockRes['setHeader'];
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_RENDER_FAILED');
    expect(getErrorObject(res).message).toBe('Download assembly failed.');
    expect(JSON.stringify(res.body)).not.toContain('header write failed');
  });

  it.openspec('OA-DST-025')('does not log the raw download id in error paths', async () => {
    resolveDownloadArtifactMock.mockImplementationOnce(() => {
      throw new Error('store error');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rawId = 'super-secret-bearer-token-abc123.sig-xyz';
    const req = createMockReq({ method: 'GET', query: { id: rawId } });
    const res = createMockRes();
    await downloadHandler(req, res);

    const logged = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(logged).not.toContain(rawId);
    // We do log a fingerprint (idFp), so a 12-hex-char token replaces the raw id.
    expect(logged).toMatch(/"idFp":"[0-9a-f]{12}"/);

    consoleErrorSpy.mockRestore();
  });

  // Issue #198: classify download-store unavailability so a misconfigured
  // deployment surfaces an explicit code instead of intermittent ghost 404s.
  it.openspec('OA-DST-036')('returns 500 + DOWNLOAD_STORE_UNAVAILABLE on configuration error', async () => {
    resolveDownloadArtifactMock.mockImplementationOnce(() => {
      throw new MockDownloadStoreConfigurationError('KV not configured');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_STORE_UNAVAILABLE');
    expect(res.headers['X-Download-Error-Code']).toBe('DOWNLOAD_STORE_UNAVAILABLE');
    expect(res.headers['X-Download-Store']).toBe('unavailable');
    // err.message should not leak — the body uses a generic configured copy.
    expect(JSON.stringify(res.body)).not.toContain('KV not configured');
    // Cause must be logged so ops can distinguish config vs runtime in logs.
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).toContain('"cause":"configuration"');

    consoleErrorSpy.mockRestore();
  });

  it.openspec('OA-DST-036')('returns 503 + DOWNLOAD_STORE_UNAVAILABLE on runtime error (Upstash outage)', async () => {
    resolveDownloadArtifactMock.mockImplementationOnce(() => {
      throw new MockDownloadStoreRuntimeError('upstash 5xx');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_STORE_UNAVAILABLE');
    expect(res.headers['X-Download-Error-Code']).toBe('DOWNLOAD_STORE_UNAVAILABLE');
    expect(res.headers['X-Download-Store']).toBe('unavailable');
    expect(JSON.stringify(res.body)).not.toContain('upstash 5xx');
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).toContain('"cause":"runtime"');

    consoleErrorSpy.mockRestore();
  });

  it.openspec('OA-DST-036')('HEAD parity: 503 with DOWNLOAD_STORE_UNAVAILABLE header on runtime error', async () => {
    resolveDownloadArtifactMock.mockImplementationOnce(() => {
      throw new MockDownloadStoreRuntimeError('upstash unreachable');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const req = createMockReq({ method: 'HEAD', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toBeUndefined();
    expect(res.headers['X-Download-Error-Code']).toBe('DOWNLOAD_STORE_UNAVAILABLE');
    expect(res.headers['X-Download-Store']).toBe('unavailable');

    consoleErrorSpy.mockRestore();
  });

  it.openspec('OA-DST-037')('emits X-Download-Store header on successful 200 response', async () => {
    resolveDownloadArtifactMock.mockReturnValue({
      ok: true,
      artifact: {
        template: 'common-paper-mutual-nda',
        values: { company_name: 'Acme Corp' },
        expires_at_ms: Date.now() + 3600000,
        created_at_ms: Date.now(),
      },
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);
    getDownloadStorageModeMock.mockReturnValueOnce('upstash');

    const req = createMockReq({ method: 'GET', query: { id: 'valid-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Download-Store']).toBe('upstash');
  });
});
