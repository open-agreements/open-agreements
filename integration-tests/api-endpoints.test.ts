/**
 * Handler-level tests for the A2A, MCP, and download Vercel endpoints.
 * Mocks the shared business logic so tests exercise only the protocol routing.
 */

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

vi.mock('../api/_shared.js', () => ({
  handleFill: handleFillMock,
  handleListTemplates: handleListTemplatesMock,
  handleGetTemplate: handleGetTemplateMock,
  createDownloadArtifact: createDownloadArtifactMock,
  resolveDownloadArtifact: resolveDownloadArtifactMock,
  DOCX_MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PROJECT_ROOT: '/mock',
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
});

// ---------------------------------------------------------------------------
// A2A endpoint tests
// ---------------------------------------------------------------------------

const { default: a2aHandler } = await import('../api/a2a.js');

describe('A2A endpoint — api/a2a.ts', () => {
  it.openspec('OA-146')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it.openspec('OA-146')('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it.openspec('OA-146')('returns JSON-RPC error for invalid request body', async () => {
    const req = createMockReq({ body: { notJsonRpc: true } });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getErrorObject(res).code).toBe(-32600);
  });

  it.openspec('OA-146')('returns JSON-RPC error for unsupported methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 1, method: 'tasks/get' },
    });
    const res = createMockRes();
    await a2aHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getErrorObject(res).code).toBe(-32601);
    expect(String(getErrorObject(res).message)).toContain('tasks/get');
  });

  it.openspec('OA-146')('routes list-templates skill to handleListTemplates', async () => {
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

  it.openspec('OA-146')('routes fill-template skill to handleFill', async () => {
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

  it.openspec('OA-146')('returns failed status when handleFill fails', async () => {
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

  it.openspec('OA-146')('returns error for unknown skill', async () => {
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

  it.openspec('OA-146')('returns error when message parts are missing', async () => {
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
  it.openspec('OA-147')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Mcp-Session-Id');
  });

  it.openspec('OA-147')('returns 405 JSON for non-browser GET requests', async () => {
    const req = createMockReq({ method: 'GET', headers: { accept: 'application/json' } });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(405);
    expect(String(asObject(res.body).error)).toContain('Only POST');
  });

  it.openspec('OA-147')('returns 200 HTML for browser-style GET requests', async () => {
    const req = createMockReq({ method: 'GET', headers: { accept: 'text/html' } });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/html');
    expect(typeof res.body).toBe('string');
    expect(String(res.body)).toContain('OpenAgreements MCP endpoint');
  });

  it.openspec('OA-147')('handles initialize handshake', async () => {
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
    expect(result.capabilities.tools).toBeDefined();
  });

  it.openspec('OA-147')('returns 202 for notifications (no id)', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-148')('handles tools/list', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    await allureJsonAttachment('mcp-tools-list.json', res.body);

    const tools = getResultObject(res).tools;
    expect(tools).toHaveLength(4);
    expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'download_filled',
      'fill_template',
      'get_template',
      'list_templates',
    ]);
  });

  it.openspec('OA-148')('handles tools/call list_templates with envelope response', async () => {
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
    expect(envelope.data.mode).toBe('full');
    expect(envelope.data.templates).toHaveLength(1);
    expect(envelope.data.rate_limit).toBeDefined();
  });

  it.openspec('OA-148')('handles tools/call get_template', async () => {
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

  it.openspec('OA-083')('handles tools/call fill_template with URL return_mode envelope', async () => {
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({
      headers: { 'content-type': 'application/json', host: 'openagreements.ai' },
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

  it.openspec('OA-148')('returns INVALID_ARGUMENT envelope for fill_template with missing template arg', async () => {
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

  it.openspec('OA-148')('returns TEMPLATE_NOT_FOUND envelope for fill_template when handleFill fails', async () => {
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

  it.openspec('OA-148')('returns INVALID_ARGUMENT envelope for unknown tool name', async () => {
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

  it.openspec('OA-147')('responds to ping', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 8, method: 'ping' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(getResultObject(res)).toEqual({});
  });

  it.openspec('OA-147')('returns method-not-supported for unknown methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 9, method: 'resources/list' },
    });
    const res = createMockRes();
    await mcpHandler(req, res);

    expect(getErrorObject(res).code).toBe(-32601);
  });

  it.openspec('OA-147')('returns 400 for invalid JSON-RPC body', async () => {
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
  it.openspec('OA-149')('returns 405 for non-GET/HEAD methods', async () => {
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(405);
  });

  it.openspec('OA-149')('returns 400 with machine-readable code when id is missing', async () => {
    const req = createMockReq({ method: 'GET', query: {} });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_ID_MISSING');
    expect(String(getErrorObject(res).message)).toContain('"id"');
  });

  it.openspec('OA-086')('returns 403 with machine-readable code for invalid signature', async () => {
    resolveDownloadArtifactMock.mockReturnValue({ ok: false, code: 'DOWNLOAD_SIGNATURE_INVALID' });

    const req = createMockReq({ method: 'GET', query: { id: 'bad-download-id' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(getErrorObject(res).code).toBe('DOWNLOAD_SIGNATURE_INVALID');
  });

  it.openspec('OA-149')('renders a user-facing HTML error page when browser clients request text/html', async () => {
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

  it.openspec('OA-084')('serves DOCX for valid download_id', async () => {
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

  it.openspec('OA-149')('returns 500 with machine-readable code when fill fails for a valid id', async () => {
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

  it.openspec('OA-085')('supports HEAD for valid download_id without response body', async () => {
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

  it.openspec('OA-087')('supports HEAD error probing with status parity', async () => {
    resolveDownloadArtifactMock.mockReturnValue({ ok: false, code: 'DOWNLOAD_EXPIRED' });

    const req = createMockReq({ method: 'HEAD', query: { id: 'expired-id.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(410);
    expect(res.headers['X-Download-Error-Code']).toBe('DOWNLOAD_EXPIRED');
    expect(res.body).toBeUndefined();
    expect(res.ended).toBe(true);
  });

  it.openspec('OA-149')('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await downloadHandler(req, res);

    expect(res.statusCode).toBe(204);
  });
});
