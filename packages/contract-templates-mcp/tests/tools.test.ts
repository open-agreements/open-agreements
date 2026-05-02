import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors, _resetModuleCache, _setModuleOverride } from '../src/core/tools.js';

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
}

function readDocxText(base64: string): string {
  const buffer = Buffer.from(base64, 'base64');
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error('word/document.xml not found in DOCX archive');
  }
  const xml = entry.getData().toString('utf-8');
  const visibleText: string[] = [];
  const runRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = runRe.exec(xml)) !== null) {
    visibleText.push(decodeXmlEntities(match[1]));
  }
  return visibleText.join('');
}

const it = itAllure.epic('Platform & Distribution');

function getPayload(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockModules(overrides: Record<string, unknown> = {}): any {
  return {
    listTemplateItems: () => [],
    findTemplateDir: () => '/mock/dir',
    loadMetadata: () => ({ name: 'mock', fields: [], priority_fields: [] }),
    fillTemplate: async () => ({}),
    categoryFromId: () => 'general',
    sourceName: () => null,
    mapFields: (f: unknown[]) => f,
    ...overrides,
  };
}

describe('contract-templates-mcp tools', () => {
  it.openspec('OA-DST-033')('lists expected tools', () => {
    const names = listToolDescriptors().map((tool) => tool.name);
    // Signing tools moved to @open-agreements/signing (breaking change)
    expect(names).toEqual([
      'list_templates',
      'get_template',
      'fill_template',
    ]);
  });

  it.openspec('OA-DST-033')('returns a full template list payload', async () => {
    const result = await callTool('list_templates', { mode: 'full' });
    const payload = getPayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe('list_templates');
    const data = payload.data as Record<string, unknown>;
    expect(data.mode).toBe('full');
    const templates = data.templates as Array<Record<string, unknown>>;
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
  });

  it.openspec('OA-DST-033')('get_template returns a known template by ID', async () => {
    const result = await callTool('get_template', { template_id: 'common-paper-mutual-nda' });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    const template = data.template as Record<string, unknown>;
    expect(template.template_id).toBe('common-paper-mutual-nda');
    expect(Array.isArray(template.fields)).toBe(true);
  });

  it.openspec('OA-DST-033')('returns TEMPLATE_NOT_FOUND for an unknown template id', async () => {
    const result = await callTool('get_template', { template_id: 'nonexistent-template-id' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    expect(payload.tool).toBe('get_template');
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it.openspec('OA-DST-033')('fill_template fills a template in-process', async () => {
    const result = await callTool('fill_template', {
      template: 'common-paper-mutual-nda',
      values: {
        purpose: 'Evaluating a potential partnership',
        effective_date: '2026-03-03',
        mnda_term: '2 years',
        confidentiality_term: '3 years',
        confidentiality_term_start: 'Effective Date',
        governing_law: 'California',
        jurisdiction: 'courts located in San Francisco County, California',
      },
      return_mode: 'inline_base64',
    });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.template).toBe('common-paper-mutual-nda');
    expect(typeof data.inline_base64).toBe('string');
    expect((data.inline_base64 as string).length).toBeGreaterThan(100);
  });

  // -----------------------------------------------------------------------
  // Group A: Happy-path & envelope tests
  // -----------------------------------------------------------------------

  it.openspec('OA-DST-032')('list_templates compact mode returns field_count', async () => {
    const result = await callTool('list_templates', { mode: 'compact' });
    const payload = getPayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.mode).toBe('compact');
    const templates = data.templates as Array<Record<string, unknown>>;
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    // compact templates have field_count, not full field arrays
    expect(typeof templates[0].field_count).toBe('number');
    expect(templates[0].fields).toBeUndefined();
  });

  it.openspec('OA-DST-033')('fill_template local_path return mode', async () => {
    const result = await callTool('fill_template', {
      template: 'common-paper-mutual-nda',
      values: {
        purpose: 'Testing local_path return',
        effective_date: '2026-03-03',
        mnda_term: '2 years',
        confidentiality_term: '3 years',
        confidentiality_term_start: 'Effective Date',
        governing_law: 'California',
        jurisdiction: 'San Francisco County',
      },
      return_mode: 'local_path',
    });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.return_mode).toBe('local_path');
    expect(typeof data.output_path).toBe('string');
    // local_path mode should NOT include inline_base64
    expect(data.inline_base64).toBeUndefined();
  });

  it.openspec('OA-DST-033')('fill_template fills the Wyoming restrictive covenant template from canonical markdown source', async () => {
    const result = await callTool('fill_template', {
      template: 'openagreements-restrictive-covenant-wyoming',
      values: {
        employer_name: 'Acme Corporation',
        employee_name: 'Jane Doe',
        employee_title: 'Vice President of Sales',
        effective_date: '2026-04-28',
        worker_category: 'Executive',
        restriction_pathways: 'Executive or Management Personnel, Trade Secret Protection',
        employee_nonsolicit_included: 'true',
        customer_nonsolicit_included: 'true',
        noncompete_included: 'true',
        territory: 'the states where Employee sold Employer services',
        competitive_business_definition: 'the design, sale, implementation, or support of enterprise workflow software',
        specified_competitors: 'Contoso, Globex',
        nondealing_included: 'true',
        noninvestment_included: 'true',
        cloud_drive_id: 'workspace://agreements/wy-rca-001',
      },
      return_mode: 'inline_base64',
    });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.template).toBe('openagreements-restrictive-covenant-wyoming');
    expect(data.return_mode).toBe('inline_base64');
    expect(typeof data.output_path).toBe('string');
    expect(typeof data.inline_base64).toBe('string');
    expect((data.inline_base64 as string).length).toBeGreaterThan(10_000);
  });

  it.openspec('OA-DST-033')('fill_template fills the employee IP assignment template from canonical markdown source', async () => {
    const result = await callTool('fill_template', {
      template: 'openagreements-employee-ip-inventions-assignment',
      values: {
        company_name: 'Acme Corporation',
        employee_name: 'Jane Doe',
        effective_date: '2026-04-28',
        confidential_information_definition: 'non-public information relating to Company business, products, roadmaps, customers, and trade secrets',
        return_of_materials_timing: 'within 3 business days after termination of employment',
        cloud_drive_id: 'workspace://agreements/piia-001',
      },
      return_mode: 'inline_base64',
    });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    expect(data.template).toBe('openagreements-employee-ip-inventions-assignment');
    expect(data.return_mode).toBe('inline_base64');
    expect(typeof data.output_path).toBe('string');
    expect(typeof data.inline_base64).toBe('string');
    expect((data.inline_base64 as string).length).toBeGreaterThan(10_000);

    const documentXml = readDocxText(data.inline_base64 as string);
    expect(documentXml).toContain('Acme Corporation');
    expect(documentXml).toContain('Jane Doe');
    expect(documentXml).toContain('2026-04-28');
    expect(documentXml).not.toContain('{company_name}');
    expect(documentXml).not.toContain('{employee_name}');
    expect(documentXml).not.toContain('[[');
    // Wyoming-alignment: the canonical Defined Terms clause must render with
    // its heading and at least one defined term name from the clause.
    expect(documentXml).toContain('Defined Terms');
    expect(documentXml).toContain('Covered Inventions');
  });

  it.openspec('OA-DST-033')('fill_template returns TEMPLATE_NOT_FOUND for unknown template', async () => {
    const result = await callTool('fill_template', {
      template: 'nonexistent-template',
      values: {},
    });
    const payload = getPayload(result);
    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it.openspec('OA-DST-032')('callTool returns error for unknown tool name', async () => {
    const result = await callTool('nonexistent_tool', {});
    const payload = getPayload(result);
    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('INVALID_ARGUMENT');
    expect(error.message).toContain('Unknown tool');
  });

  it.openspec('OA-DST-032')('callTool returns INVALID_ARGUMENT for Zod validation error', async () => {
    // template_id is required and must be min(1); passing empty string triggers Zod
    const result = await callTool('get_template', { template_id: '' });
    const payload = getPayload(result);
    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('INVALID_ARGUMENT');
  });

  // -----------------------------------------------------------------------
  // Group B: Error & fallback tests via _setModuleOverride
  // -----------------------------------------------------------------------

  describe('with module override', () => {
    afterEach(() => {
      _resetModuleCache();
    });

    it.openspec('OA-DST-032')('get_template catches loadMetadata error', async () => {
      _setModuleOverride(mockModules({
        loadMetadata: () => { throw new Error('corrupt metadata'); },
      }));
      const result = await callTool('get_template', { template_id: 'test-template' });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it.openspec('OA-DST-034')('get_template preserves nested array item schemas', async () => {
      _setModuleOverride(mockModules({
        loadMetadata: () => ({
          name: 'Array Template',
          source_url: 'https://example.com/template.docx',
          fields: [
            {
              name: 'signers',
              type: 'array',
              description: 'Signers on the document',
              items: [
                { name: 'name', type: 'string', description: 'Printed signer name' },
                { name: 'title', type: 'string', description: 'Printed signer title', default: '' },
              ],
            },
          ],
          priority_fields: [],
        }),
        mapFields: (fields: unknown[]) => fields,
      }));

      const result = await callTool('get_template', { template_id: 'array-template' });
      const payload = getPayload(result);

      expect(result.isError).toBeUndefined();
      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      const template = data.template as Record<string, unknown>;
      const fields = template.fields as Array<Record<string, unknown>>;
      expect(fields[0]).toMatchObject({
        name: 'signers',
        type: 'array',
      });
      expect(fields[0].items).toEqual([
        { name: 'name', type: 'string', description: 'Printed signer name' },
        { name: 'title', type: 'string', description: 'Printed signer title', default: '' },
      ]);
    });

    it.openspec('OA-TMP-045')('strips display_label from list_templates and get_template payloads (top-level + nested)', async () => {
      _setModuleOverride(mockModules({
        listTemplateItems: () => [
          {
            name: 'labeled-template',
            category: 'general',
            description: 'Labeled template',
            license: null,
            source_url: 'https://example.com/labeled-template',
            source: null,
            fields: [
              {
                name: 'company_name',
                type: 'string',
                required: true,
                section: null,
                description: 'Company name',
                display_label: 'Company Name',
                default: null,
              },
              {
                name: 'signers',
                type: 'array',
                required: false,
                section: null,
                description: 'Signers',
                display_label: 'Signers',
                default: null,
                items: [
                  {
                    name: 'printed_name',
                    type: 'string',
                    required: false,
                    section: null,
                    description: 'Printed signer name',
                    display_label: 'Printed Name',
                    default: null,
                  },
                ],
              },
            ],
          },
        ],
        loadMetadata: () => ({
          name: 'Labeled Template',
          source_url: 'https://example.com/labeled-template',
          fields: [
            {
              name: 'company_name',
              type: 'string',
              description: 'Company name',
              display_label: 'Company Name',
            },
            {
              name: 'signers',
              type: 'array',
              description: 'Signers',
              display_label: 'Signers',
              items: [
                {
                  name: 'printed_name',
                  type: 'string',
                  description: 'Printed signer name',
                  display_label: 'Printed Name',
                },
              ],
            },
          ],
          priority_fields: [],
        }),
        mapFields: (fields: unknown[]) => fields,
      }));

      const listResult = await callTool('list_templates', { mode: 'full' });
      const listPayload = getPayload(listResult);
      const listData = listPayload.data as Record<string, unknown>;
      const templates = listData.templates as Array<Record<string, unknown>>;
      const listFields = templates[0].fields as Array<Record<string, unknown>>;
      expect(listFields[0]).not.toHaveProperty('display_label');
      expect(listFields[1]).not.toHaveProperty('display_label');
      const listNestedItems = listFields[1].items as Array<Record<string, unknown>>;
      expect(listNestedItems[0]).not.toHaveProperty('display_label');

      const getResult = await callTool('get_template', { template_id: 'labeled-template' });
      const getPayloadData = getPayload(getResult);
      const getData = getPayloadData.data as Record<string, unknown>;
      const template = getData.template as Record<string, unknown>;
      const getFields = template.fields as Array<Record<string, unknown>>;
      expect(getFields[0]).not.toHaveProperty('display_label');
      expect(getFields[1]).not.toHaveProperty('display_label');
      const getNestedItems = getFields[1].items as Array<Record<string, unknown>>;
      expect(getNestedItems[0]).not.toHaveProperty('display_label');
    });

    it.openspec('OA-DST-032')('fill_template returns FILL_FAILED on engine error', async () => {
      _setModuleOverride(mockModules({
        fillTemplate: async () => { throw new Error('engine failure'); },
      }));
      const result = await callTool('fill_template', {
        template: 'test-template',
        values: {},
      });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('FILL_FAILED');
      expect(error.message).toBe('engine failure');
    });

    it.openspec('OA-DST-032')('fill_template returns TEMPLATE_NOT_FOUND when error mentions unknown template', async () => {
      _setModuleOverride(mockModules({
        fillTemplate: async () => { throw new Error('unknown template: bad-id'); },
      }));
      const result = await callTool('fill_template', {
        template: 'bad-id',
        values: {},
      });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it.openspec('OA-DST-032')('fill_template extracts stderr from error object', async () => {
      _setModuleOverride(mockModules({
        fillTemplate: async () => { throw { stderr: 'stderr error message', stdout: '', message: '' }; },
      }));
      const result = await callTool('fill_template', {
        template: 'test-template',
        values: {},
      });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.message).toBe('stderr error message');
    });

    it.openspec('OA-DST-032')('fill_template falls back to stdout when stderr is empty', async () => {
      _setModuleOverride(mockModules({
        fillTemplate: async () => { throw { stderr: '', stdout: 'stdout fallback message', message: '' }; },
      }));
      const result = await callTool('fill_template', {
        template: 'test-template',
        values: {},
      });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.message).toBe('stdout fallback message');
    });

    it.openspec('OA-DST-032')('fill_template handles non-object error (string throw)', async () => {
      _setModuleOverride(mockModules({
        fillTemplate: async () => { throw 'string error'; },
      }));
      const result = await callTool('fill_template', {
        template: 'test-template',
        values: {},
      });
      const payload = getPayload(result);
      expect(result.isError).toBe(true);
      const error = payload.error as Record<string, unknown>;
      expect(error.message).toBe('string error');
    });

    it.openspec('OA-DST-032')('_resetModuleCache clears override between calls', async () => {
      // First call: override returns empty list
      _setModuleOverride(mockModules({
        listTemplateItems: () => [],
      }));
      const result1 = await callTool('list_templates', { mode: 'compact' });
      const data1 = (getPayload(result1).data as Record<string, unknown>);
      expect((data1.templates as unknown[]).length).toBe(0);

      // Reset, override cleared — real modules load again
      _resetModuleCache();
      const result2 = await callTool('list_templates', { mode: 'compact' });
      const data2 = (getPayload(result2).data as Record<string, unknown>);
      expect((data2.templates as unknown[]).length).toBeGreaterThan(0);
    });
  });
});
