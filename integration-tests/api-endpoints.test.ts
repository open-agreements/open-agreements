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
const createDownloadTokenMock = vi.fn(() => 'mock-token.mock-sig');
const parseDownloadTokenMock = vi.fn();

vi.mock('../api/_shared.js', () => ({
  handleFill: handleFillMock,
  handleListTemplates: handleListTemplatesMock,
  createDownloadToken: createDownloadTokenMock,
  parseDownloadToken: parseDownloadTokenMock,
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

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// A2A endpoint tests
// ---------------------------------------------------------------------------

const { default: a2aHandler } = await import('../api/a2a.js');

describe('A2A endpoint — api/a2a.ts', () => {
  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await a2aHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await a2aHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
  });

  it('returns JSON-RPC error for invalid request body', async () => {
    const req = createMockReq({ body: { notJsonRpc: true } });
    const res = createMockRes();
    await a2aHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).error.code).toBe(-32600);
  });

  it('returns JSON-RPC error for unsupported methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 1, method: 'tasks/get' },
    });
    const res = createMockRes();
    await a2aHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).error.code).toBe(-32601);
    expect((res.body as any).error.message).toContain('tasks/get');
  });

  it('routes list-templates skill to handleListTemplates', async () => {
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
    await a2aHandler(req as any, res as any);

    await allureJsonAttachment('a2a-list-response.json', res.body);

    expect(res.statusCode).toBe(200);
    expect(handleListTemplatesMock).toHaveBeenCalledTimes(1);
    const result = (res.body as any).result;
    expect(result.status.state).toBe('completed');
    expect(result.artifacts[0].parts[0].data.items).toHaveLength(1);
  });

  it('routes fill-template skill to handleFill', async () => {
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
    await a2aHandler(req as any, res as any);

    await allureJsonAttachment('a2a-fill-response.json', res.body);

    expect(res.statusCode).toBe(200);
    expect(handleFillMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });
    const result = (res.body as any).result;
    expect(result.status.state).toBe('completed');
    expect(result.artifacts[0].parts[0].data.inlineData).toBe(MOCK_FILL_SUCCESS.base64);
  });

  it('returns failed status when handleFill fails', async () => {
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
    await a2aHandler(req as any, res as any);

    const result = (res.body as any).result;
    expect(result.status.state).toBe('failed');
    expect(result.status.message).toContain('nonexistent');
  });

  it('returns error for unknown skill', async () => {
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
    await a2aHandler(req as any, res as any);

    expect((res.body as any).error.message).toContain('unknown-skill');
  });

  it('returns error when message parts are missing', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'message/send',
        params: { message: {} },
      },
    });
    const res = createMockRes();
    await a2aHandler(req as any, res as any);

    expect((res.body as any).error.code).toBe(-32602);
  });
});

// ---------------------------------------------------------------------------
// MCP endpoint tests
// ---------------------------------------------------------------------------

const { default: mcpHandler } = await import('../api/mcp.js');

describe('MCP endpoint — api/mcp.ts', () => {
  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Mcp-Session-Id');
  });

  it('returns 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
  });

  it('handles initialize handshake', async () => {
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
    await mcpHandler(req as any, res as any);

    await allureJsonAttachment('mcp-initialize-response.json', res.body);

    expect(res.statusCode).toBe(200);
    const result = (res.body as any).result;
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.serverInfo.name).toBe('OpenAgreements');
    expect(result.capabilities.tools).toBeDefined();
  });

  it('returns 202 for notifications (no id)', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(202);
    expect(res.ended).toBe(true);
  });

  it('handles tools/list', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    await allureJsonAttachment('mcp-tools-list.json', res.body);

    const tools = (res.body as any).result.tools;
    expect(tools).toHaveLength(3);
    expect(tools.map((t: any) => t.name).sort()).toEqual(['create_closing_checklist', 'fill_template', 'list_templates']);
  });

  it('handles tools/call list_templates', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(handleListTemplatesMock).toHaveBeenCalledTimes(1);
    const content = (res.body as any).result.content;
    expect(content).toHaveLength(2); // summary + JSON
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('Available templates');
  });

  it('handles tools/call fill_template with download URL', async () => {
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
    await mcpHandler(req as any, res as any);

    await allureJsonAttachment('mcp-fill-response.json', res.body);

    expect(handleFillMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });
    expect(createDownloadTokenMock).toHaveBeenCalledWith('common-paper-mutual-nda', { company_name: 'Acme Corp' });

    const content = (res.body as any).result.content;
    expect(content).toHaveLength(1); // text only — no binary blob
    expect(content[0].text).toContain('Download your DOCX');
    expect(content[0].text).toContain('/api/download?token=');
    expect(content[0].text).toContain('expires in 1 hour');
  });

  it('returns error for fill_template with missing template arg', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'fill_template', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    const result = (res.body as any).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toMatch(/required|expected string/i);
  });

  it('returns error for fill_template when handleFill fails', async () => {
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
    await mcpHandler(req as any, res as any);

    const result = (res.body as any).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nonexistent');
  });

  it('returns error for unknown tool name', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'unknown_tool', arguments: {} },
      },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    const result = (res.body as any).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unknown_tool');
  });

  it('responds to ping', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 8, method: 'ping' },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect((res.body as any).result).toEqual({});
  });

  it('returns method-not-supported for unknown methods', async () => {
    const req = createMockReq({
      body: { jsonrpc: '2.0', id: 9, method: 'resources/list' },
    });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect((res.body as any).error.code).toBe(-32601);
  });

  it('returns 400 for invalid JSON-RPC body', async () => {
    const req = createMockReq({ body: { not: 'jsonrpc' } });
    const res = createMockRes();
    await mcpHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Download endpoint tests
// ---------------------------------------------------------------------------

const { default: downloadHandler } = await import('../api/download.js');

describe('Download endpoint — api/download.ts', () => {
  it('returns 405 for non-GET methods', async () => {
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    expect(res.statusCode).toBe(405);
  });

  it('returns 400 when token is missing', async () => {
    const req = createMockReq({ method: 'GET', query: {} });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toContain('token');
  });

  it('returns 403 for invalid token', async () => {
    parseDownloadTokenMock.mockReturnValue(null);

    const req = createMockReq({ method: 'GET', query: { token: 'bad-token' } });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect((res.body as any).error).toContain('expired');
  });

  it('serves DOCX for valid token', async () => {
    parseDownloadTokenMock.mockReturnValue({
      t: 'common-paper-mutual-nda',
      v: { company_name: 'Acme Corp' },
      e: Date.now() + 3600000,
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_SUCCESS);

    const req = createMockReq({ method: 'GET', query: { token: 'valid-token.valid-sig' } });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    await allureJsonAttachment('download-response-headers.json', res.headers);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('wordprocessingml.document');
    expect(res.headers['Content-Disposition']).toContain('common-paper-mutual-nda.docx');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('returns 500 when handleFill fails for a valid token', async () => {
    parseDownloadTokenMock.mockReturnValue({
      t: 'nonexistent',
      v: {},
      e: Date.now() + 3600000,
    });
    handleFillMock.mockResolvedValue(MOCK_FILL_FAILURE);

    const req = createMockReq({ method: 'GET', query: { token: 'valid-but-bad-template' } });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    expect(res.statusCode).toBe(500);
    expect((res.body as any).error).toContain('nonexistent');
  });

  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    await downloadHandler(req as any, res as any);

    expect(res.statusCode).toBe(204);
  });
});
