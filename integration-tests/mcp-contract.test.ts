/**
 * Contract tests for MCP response envelopes and tool behaviors.
 */

import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure, allureJsonAttachment } from './helpers/allure-test.js';

const it = itAllure.epic('Platform & Distribution');

const MOCK_TEMPLATE = {
  name: 'common-paper-mutual-nda',
  category: 'general',
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

const VALID_TOKEN = 'valid-token.mock-sig';

const handleListTemplatesMock = vi.fn(() => MOCK_LIST_RESULT);
const handleGetTemplateMock = vi.fn((templateId: string) => (
  templateId === MOCK_TEMPLATE.name ? MOCK_TEMPLATE : null
));
const handleFillMock = vi.fn(async (template: string) => (
  template === 'nonexistent' ? MOCK_FILL_TEMPLATE_NOT_FOUND : MOCK_FILL_SUCCESS
));
const createDownloadTokenMock = vi.fn(() => VALID_TOKEN);
const parseDownloadTokenMock = vi.fn((token: string) => {
  if (token !== VALID_TOKEN) return null;
  return {
    t: MOCK_TEMPLATE.name,
    v: { company_name: 'Acme Corp' },
    e: Date.now() + 3600000,
  };
});

vi.mock('../api/_shared.js', () => ({
  handleListTemplates: handleListTemplatesMock,
  handleGetTemplate: handleGetTemplateMock,
  handleFill: handleFillMock,
  createDownloadToken: createDownloadTokenMock,
  parseDownloadToken: parseDownloadTokenMock,
  DOCX_MIME: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}));

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

function parseEnvelope(body: any) {
  const text = body?.result?.content?.[0]?.text;
  return JSON.parse(text as string);
}

const { default: mcpHandler } = await import('../api/mcp.js');

afterEach(() => {
  vi.clearAllMocks();
});

describe('MCP contract envelope behaviors', () => {
  it('returns a consistent success envelope shape for list_templates', async () => {
    const req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: {} },
      },
    });
    const res = createMockRes();

    await mcpHandler(req as any, res as any);

    const envelope = parseEnvelope(res.body);
    await allureJsonAttachment('mcp-contract-list-templates-success.json', envelope);

    expect(res.statusCode).toBe(200);
    expect(envelope.ok).toBe(true);
    expect(envelope.tool).toBe('list_templates');
    expect(envelope.schema_version).toBe('2026-02-19');
    expect(envelope.data.templates).toHaveLength(1);
    expect(envelope.data.rate_limit).toEqual({ limit: null, remaining: null, reset_at: null });
    expect(envelope.data.auth).toBeNull();
  });

  it('returns compact and full list_templates payload modes', async () => {
    const compactReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_templates', arguments: { mode: 'compact' } },
      },
    });
    const compactRes = createMockRes();
    await mcpHandler(compactReq as any, compactRes as any);

    const compactEnvelope = parseEnvelope(compactRes.body);
    expect(compactEnvelope.ok).toBe(true);
    expect(compactEnvelope.data.mode).toBe('compact');
    expect(compactEnvelope.data.templates[0]).toEqual({
      template_id: 'common-paper-mutual-nda',
      name: 'common-paper-mutual-nda',
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
    await mcpHandler(fullReq as any, fullRes as any);

    const fullEnvelope = parseEnvelope(fullRes.body);
    expect(fullEnvelope.ok).toBe(true);
    expect(fullEnvelope.data.mode).toBe('full');
    expect(fullEnvelope.data.templates[0].template_id).toBe('common-paper-mutual-nda');
    expect(fullEnvelope.data.templates[0].fields).toHaveLength(2);
  });

  it('returns get_template found and TEMPLATE_NOT_FOUND envelopes', async () => {
    const foundReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'get_template', arguments: { template_id: 'common-paper-mutual-nda' } },
      },
    });
    const foundRes = createMockRes();
    await mcpHandler(foundReq as any, foundRes as any);

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
    await mcpHandler(missingReq as any, missingRes as any);

    const missingEnvelope = parseEnvelope(missingRes.body);
    expect((missingRes.body as any).result.isError).toBe(true);
    expect(missingEnvelope.ok).toBe(false);
    expect(missingEnvelope.error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('returns fill_template envelopes for url, base64_docx, and mcp_resource', async () => {
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
    await mcpHandler(urlReq as any, urlRes as any);

    const urlEnvelope = parseEnvelope(urlRes.body);
    expect(urlEnvelope.ok).toBe(true);
    expect(urlEnvelope.data.return_mode).toBe('url');
    expect(urlEnvelope.data.download_url).toContain('/api/download?token=');
    expect(urlEnvelope.data.token).toBe(VALID_TOKEN);

    const base64Req = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            values: { company_name: 'Acme Corp' },
            return_mode: 'base64_docx',
          },
        },
      },
    });
    const base64Res = createMockRes();
    await mcpHandler(base64Req as any, base64Res as any);

    const base64Envelope = parseEnvelope(base64Res.body);
    expect(base64Envelope.ok).toBe(true);
    expect(base64Envelope.data.return_mode).toBe('base64_docx');
    expect(base64Envelope.data.docx_base64).toBe(MOCK_FILL_SUCCESS.base64);
    expect(base64Envelope.data.content_type).toContain('wordprocessingml.document');

    const resourceReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 8,
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
    await mcpHandler(resourceReq as any, resourceRes as any);

    const resourceEnvelope = parseEnvelope(resourceRes.body);
    expect(resourceEnvelope.ok).toBe(true);
    expect(resourceEnvelope.data.return_mode).toBe('mcp_resource');
    expect(resourceEnvelope.data.resource_uri).toBe(`oa://filled/${VALID_TOKEN}`);
    expect(resourceEnvelope.data.download_url).toContain('/api/download?token=');
  });

  it('returns download_filled success and TOKEN_EXPIRED error envelopes', async () => {
    const validReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'download_filled', arguments: { token: VALID_TOKEN } },
      },
    });
    const validRes = createMockRes();
    await mcpHandler(validReq as any, validRes as any);

    const validEnvelope = parseEnvelope(validRes.body);
    expect(validEnvelope.ok).toBe(true);
    expect(validEnvelope.tool).toBe('download_filled');
    expect(validEnvelope.data.docx_base64).toBe(MOCK_FILL_SUCCESS.base64);
    expect(validEnvelope.data.token_expires_at).toBeDefined();

    const expiredReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: { name: 'download_filled', arguments: { token: 'expired-token' } },
      },
    });
    const expiredRes = createMockRes();
    await mcpHandler(expiredReq as any, expiredRes as any);

    const expiredEnvelope = parseEnvelope(expiredRes.body);
    expect((expiredRes.body as any).result.isError).toBe(true);
    expect(expiredEnvelope.ok).toBe(false);
    expect(expiredEnvelope.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns INVALID_ARGUMENT for invalid arguments and unknown tool', async () => {
    const invalidArgReq = createMockReq({
      body: {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'fill_template',
          arguments: {
            template: 'common-paper-mutual-nda',
            return_mode: 'invalid-mode',
          },
        },
      },
    });
    const invalidArgRes = createMockRes();
    await mcpHandler(invalidArgReq as any, invalidArgRes as any);

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
    await mcpHandler(unknownToolReq as any, unknownToolRes as any);

    const unknownToolEnvelope = parseEnvelope(unknownToolRes.body);
    expect(unknownToolEnvelope.ok).toBe(false);
    expect(unknownToolEnvelope.error.code).toBe('INVALID_ARGUMENT');
  });

  it('returns HTML for browser GET and 405 for non-browser GET', async () => {
    const browserReq = createMockReq({ method: 'GET', headers: { accept: 'text/html' } });
    const browserRes = createMockRes();
    await mcpHandler(browserReq as any, browserRes as any);

    expect(browserRes.statusCode).toBe(200);
    expect(browserRes.headers['Content-Type']).toContain('text/html');
    expect(String(browserRes.body)).toContain('OpenAgreements MCP endpoint');

    const nonBrowserReq = createMockReq({ method: 'GET', headers: { accept: 'application/json' } });
    const nonBrowserRes = createMockRes();
    await mcpHandler(nonBrowserReq as any, nonBrowserRes as any);

    expect(nonBrowserRes.statusCode).toBe(405);
    expect((nonBrowserRes.body as any).error).toContain('Only POST');
  });
});
