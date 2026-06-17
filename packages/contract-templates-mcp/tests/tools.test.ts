import AdmZip from 'adm-zip';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors, _resetModuleCache, _setModuleOverride } from '../src/core/tools.js';
import { loadMetadata } from '../../../dist/core/metadata.js';
import { findTemplateDir } from '../../../dist/utils/paths.js';

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
  it.openspec('OA-DST-078')('lists expected tools', () => {
    const names = listToolDescriptors().map((tool) => tool.name);
    // Signing tools removed (signing feature deleted)
    expect(names).toEqual([
      'list_templates',
      'get_template',
      'fill_template',
    ]);
  });

  it.openspec('OA-DST-054')('returns compact-only template shape with pagination envelope', async () => {
    const result = await callTool('list_templates', {});
    const payload = getPayload(result);

    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe('list_templates');
    const data = payload.data as Record<string, unknown>;
    expect(data.mode).toBeUndefined();
    const templates = data.templates as Array<Record<string, unknown>>;
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    expect(typeof data.total_count).toBe('number');
    const totalCount = data.total_count as number;
    if (totalCount <= 25) {
      // Catalog fits in default page
      expect(templates.length).toBe(totalCount);
      expect(data.next_cursor).toBeNull();
    } else {
      // Catalog exceeds default page; expect a full page and a cursor
      expect(templates.length).toBe(25);
      expect(typeof data.next_cursor).toBe('string');
      expect((data.next_cursor as string).length).toBeGreaterThan(0);
    }

    // Compact shape exact-keys assertion
    expect(Object.keys(templates[0]).sort()).toEqual([
      'category',
      'description',
      'display_name',
      'field_count',
      'priority_field_count',
      'template_id',
    ]);
    for (const t of templates) {
      expect(typeof t.template_id).toBe('string');
      expect(typeof t.display_name).toBe('string');
      expect((t.display_name as string).length).toBeGreaterThan(0);
      expect(typeof t.category).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.field_count).toBe('number');
      expect(typeof t.priority_field_count).toBe('number');
      expect(t.fields).toBeUndefined();
      expect(t.license).toBeUndefined();
      expect(t.name).toBeUndefined();
    }
  });

  it.openspec('OA-DST-055')('paginates the catalog using cursor + limit roundtrip with no duplicates', async () => {
    const allResult = await callTool('list_templates', { limit: 100 });
    const allTemplates = ((getPayload(allResult).data as Record<string, unknown>).templates) as Array<{ template_id: string }>;
    expect(allTemplates.length).toBeGreaterThan(2); // need enough to page through

    const limit = 2;
    const seen: string[] = [];
    let cursor: string | undefined;
    let totalCount: number | null = null;
    let lastNextCursor: string | null | undefined;
    for (let i = 0; i < 50; i += 1) {
      const args: Record<string, unknown> = { limit };
      if (cursor !== undefined) args.cursor = cursor;
      const r = await callTool('list_templates', args);
      const data = getPayload(r).data as Record<string, unknown>;
      if (totalCount === null) totalCount = data.total_count as number;
      else expect(data.total_count).toBe(totalCount); // total_count is stable
      const page = data.templates as Array<{ template_id: string }>;
      for (const t of page) seen.push(t.template_id);
      lastNextCursor = data.next_cursor as string | null;
      if (lastNextCursor === null) break;
      cursor = lastNextCursor;
    }

    expect(lastNextCursor).toBeNull(); // terminal page
    expect(seen.length).toBe(allTemplates.length); // no gaps
    expect(new Set(seen).size).toBe(seen.length); // no duplicates
    expect(seen).toEqual(allTemplates.map((t) => t.template_id)); // same order as full catalog
  });

  it.openspec('OA-DST-056')('maintains lexicographic continuity across page boundaries', async () => {
    const limit = 2;
    const pages: Array<Array<{ template_id: string }>> = [];
    let cursor: string | undefined;
    for (let i = 0; i < 50; i += 1) {
      const args: Record<string, unknown> = { limit };
      if (cursor !== undefined) args.cursor = cursor;
      const r = await callTool('list_templates', args);
      const data = getPayload(r).data as Record<string, unknown>;
      pages.push(data.templates as Array<{ template_id: string }>);
      const nc = data.next_cursor as string | null;
      if (nc === null) break;
      cursor = nc;
    }
    expect(pages.length).toBeGreaterThan(1); // we actually crossed at least one boundary

    for (const page of pages) {
      for (let i = 1; i < page.length; i += 1) {
        expect(page[i - 1].template_id.localeCompare(page[i].template_id)).toBeLessThan(0);
      }
    }
    for (let i = 1; i < pages.length; i += 1) {
      const prev = pages[i - 1];
      const next = pages[i];
      if (prev.length > 0 && next.length > 0) {
        expect(prev[prev.length - 1].template_id.localeCompare(next[0].template_id)).toBeLessThan(0);
      }
    }
  });

  it.openspec('OA-DST-057')('rejects out-of-range limit with INVALID_ARGUMENT', async () => {
    for (const bad of [0, -1, 101, 1000]) {
      const r = await callTool('list_templates', { limit: bad });
      expect(r.isError).toBe(true);
      const payload = getPayload(r);
      expect(payload.ok).toBe(false);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('INVALID_ARGUMENT');
      expect((error.message as string).toLowerCase()).toContain('limit');
    }
  });

  it.openspec('OA-DST-058')('rejects invalid cursor with INVALID_ARGUMENT', async () => {
    const cases = [
      'not-base64-+++',
      Buffer.from('garbage:value', 'utf8').toString('base64'),
      Buffer.from('after:zzz-template-that-does-not-exist-and-is-beyond-tail', 'utf8').toString('base64'),
    ];
    for (const cursor of cases) {
      const r = await callTool('list_templates', { cursor });
      expect(r.isError).toBe(true);
      const payload = getPayload(r);
      expect(payload.ok).toBe(false);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('INVALID_ARGUMENT');
      expect((error.message as string).toLowerCase()).toContain('cursor');
    }
  });

  it.openspec('OA-DST-058')('rejects oversized cursor before base64 decode', async () => {
    // Defense-in-depth: 512-char cap rejects bloated cursors before allocating decode buffers.
    const oversized = 'a'.repeat(1024);
    const r = await callTool('list_templates', { cursor: oversized });
    expect(r.isError).toBe(true);
    const payload = getPayload(r);
    expect(payload.ok).toBe(false);
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('INVALID_ARGUMENT');
  });

  it.openspec('OA-DST-059')('rejects legacy mode parameter with INVALID_ARGUMENT', async () => {
    for (const args of [{ mode: 'full' }, { mode: 'compact' }, { mode: 'anything' }]) {
      const r = await callTool('list_templates', args);
      expect(r.isError).toBe(true);
      const payload = getPayload(r);
      expect(payload.ok).toBe(false);
      const error = payload.error as Record<string, unknown>;
      expect(error.code).toBe('INVALID_ARGUMENT');
    }
  });

  it.openspec('OA-DST-078')('get_template returns a known template by ID', async () => {
    const result = await callTool('get_template', { template_id: 'common-paper-mutual-nda' });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    expect(payload.ok).toBe(true);
    const data = payload.data as Record<string, unknown>;
    const template = data.template as Record<string, unknown>;
    expect(template.template_id).toBe('common-paper-mutual-nda');
    expect(Array.isArray(template.fields)).toBe(true);
  });

  it.openspec('OA-DST-061')('get_template returns options for enum fields matching source metadata', async () => {
    const dir = findTemplateDir('common-paper-mutual-nda');
    if (!dir) throw new Error('common-paper-mutual-nda template not found on disk');
    const meta = loadMetadata(dir);
    const expectedEnumOptions: Record<string, string[]> = Object.fromEntries(
      meta.fields
        .filter((f: { type: string }) => f.type === 'enum')
        .map((f: { name: string; options?: string[] }) => [f.name, f.options ?? []])
    );
    expect(Object.keys(expectedEnumOptions).length).toBeGreaterThan(0);

    const result = await callTool('get_template', { template_id: 'common-paper-mutual-nda' });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    const data = payload.data as Record<string, unknown>;
    const template = data.template as Record<string, unknown>;
    const fields = template.fields as Array<Record<string, unknown>>;

    const actualEnumOptions: Record<string, string[]> = Object.fromEntries(
      fields
        .filter((f) => f.type === 'enum')
        .map((f) => [f.name as string, f.options as string[]])
    );
    expect(actualEnumOptions).toEqual(expectedEnumOptions);
  });

  it.openspec('OA-DST-062')('get_template omits options for non-enum field types', async () => {
    const result = await callTool('get_template', { template_id: 'common-paper-mutual-nda' });
    const payload = getPayload(result);
    expect(result.isError).toBeUndefined();
    const data = payload.data as Record<string, unknown>;
    const template = data.template as Record<string, unknown>;
    const fields = template.fields as Array<Record<string, unknown>>;

    const nonEnumFields = fields.filter((f) => f.type !== 'enum');
    expect(nonEnumFields.length).toBeGreaterThan(0);
    for (const field of nonEnumFields) {
      expect(field).not.toHaveProperty('options');
    }
  });

  it.openspec('OA-DST-024')('returns TEMPLATE_NOT_FOUND for an unknown template id', async () => {
    const result = await callTool('get_template', { template_id: 'nonexistent-template-id' });
    const payload = getPayload(result);

    expect(result.isError).toBe(true);
    expect(payload.ok).toBe(false);
    expect(payload.tool).toBe('get_template');
    const error = payload.error as Record<string, unknown>;
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it.openspec('OA-DST-078')('fill_template fills a template in-process', async () => {
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

  it.openspec('OA-DST-078')('fill_template local_path return mode', async () => {
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

  it.openspec('OA-DST-078')('fill_template fills the Wyoming restrictive covenant template from canonical markdown source', async () => {
    const result = await callTool('fill_template', {
      template: 'openagreements-restrictive-covenant-wyoming',
      values: {
        employer_name: 'Acme Corporation',
        employee_name: 'Jane Doe',
        employee_title: 'Vice President of Sales',
        effective_date: '2026-04-28',
        worker_category: 'Executive',
        applicable_noncompete_exceptions: 'Executive or Management Personnel, Trade Secret Protection',
        employee_nonsolicit_included: 'true',
        customer_nonsolicit_included: 'true',
        noncompete_included: 'true',
        territory: 'the states where Employee sold Employer services',
        competitive_business_definition: 'the design, sale, implementation, or support of enterprise workflow software',
        specified_competitors: 'Contoso, Globex',
        nondealing_included: 'true',
        noninvestment_included: 'true',
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

  it.openspec('OA-DST-078')('fill_template fills the employee IP assignment template from canonical markdown source', async () => {
    const result = await callTool('fill_template', {
      template: 'openagreements-employee-ip-inventions-assignment',
      values: {
        company_name: 'Acme Corporation',
        employee_name: 'Jane Doe',
        effective_date: '2026-04-28',
        confidential_information_definition: 'non-public information relating to Company business, products, roadmaps, customers, and trade secrets',
        return_of_materials_timing: 'within 3 business days after termination of employment',
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

  it.openspec('OA-DST-024')('fill_template returns TEMPLATE_NOT_FOUND for unknown template', async () => {
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

    it.openspec('OA-DST-033')('get_template preserves nested array item schemas', async () => {
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

    it.openspec('OA-TMP-045')('strips display_label from get_template payload (top-level + nested)', async () => {
      // list_templates no longer carries `fields` on the wire (compact-only contract),
      // so display_label stripping is asserted only on get_template.
      _setModuleOverride(mockModules({
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

    it.openspec('OA-DST-060')('display_name falls back to template_id when upstream metadata is empty', async () => {
      _setModuleOverride(mockModules({
        listTemplateItems: () => [
          {
            name: 'no-display-name-template',
            display_name: '', // empty upstream display_name
            category: 'general',
            description: 'A template missing its display name',
            license: null,
            source_url: 'https://example.com/template',
            source: null,
            fields: [
              { name: 'a', type: 'string', required: false, section: null, description: 'a', default: null },
            ],
          },
          {
            name: 'whitespace-display-name-template',
            display_name: '   ', // whitespace-only upstream display_name
            category: 'general',
            description: 'A template with whitespace display name',
            license: null,
            source_url: 'https://example.com/template2',
            source: null,
            fields: [
              { name: 'a', type: 'string', required: true, section: null, description: 'a', default: null },
            ],
          },
        ],
      }));

      const result = await callTool('list_templates', {});
      const payload = getPayload(result);
      expect(payload.ok).toBe(true);
      const data = payload.data as Record<string, unknown>;
      const templates = data.templates as Array<Record<string, string | number>>;
      expect(templates.length).toBe(2);
      // Both templates should have display_name === template_id (fallback)
      expect(templates[0].display_name).toBe(templates[0].template_id);
      expect(templates[1].display_name).toBe(templates[1].template_id);
      // priority_field_count derived from required fields
      expect(templates[0].priority_field_count).toBe(0);
      expect(templates[1].priority_field_count).toBe(1);
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
      const result1 = await callTool('list_templates', {});
      const data1 = (getPayload(result1).data as Record<string, unknown>);
      expect((data1.templates as unknown[]).length).toBe(0);
      expect(data1.total_count).toBe(0);
      expect(data1.next_cursor).toBeNull();

      // Reset, override cleared — real modules load again
      _resetModuleCache();
      const result2 = await callTool('list_templates', {});
      const data2 = (getPayload(result2).data as Record<string, unknown>);
      expect((data2.templates as unknown[]).length).toBeGreaterThan(0);
    });
  });
});
