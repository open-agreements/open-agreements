import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { callTool, listToolDescriptors, _resetModuleCache, _setModuleOverride } from '../src/core/tools.js';

const it = itAllure.epic('Platform & Distribution');

const CONTENT_TYPES = ['template', 'practice_guide', 'checklist', 'survey'] as const;
const DOC_CONTENT_TYPES = ['practice_guide', 'checklist', 'survey'] as const;

const COMPACT_KEYS = [
  'content_id',
  'description',
  'format',
  'jurisdiction',
  'title',
  'topic',
  'type',
  'updated_at',
];

function getPayload(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return (result.structuredContent ?? {}) as Record<string, unknown>;
}

function getData(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return getPayload(result).data as Record<string, unknown>;
}

function getError(result: Awaited<ReturnType<typeof callTool>>): Record<string, unknown> {
  return getPayload(result).error as Record<string, unknown>;
}

interface ContentEntry {
  content_id: string;
  type: string;
  title: string;
  description: string | null;
  topic: string;
  jurisdiction: string | null;
  format: string;
  updated_at: string | null;
}

async function fetchFullContentCatalog(
  extraArgs: Record<string, unknown> = {},
): Promise<ContentEntry[]> {
  const all: ContentEntry[] = [];
  let cursor: string | undefined;
  do {
    const args: Record<string, unknown> = { ...extraArgs, limit: 100 };
    if (cursor !== undefined) args.cursor = cursor;
    const result = await callTool('list_content', args);
    expect(result.isError).toBeUndefined();
    const data = getData(result);
    all.push(...(data.items as ContentEntry[]));
    cursor = (data.next_cursor as string | null) ?? undefined;
  } while (cursor !== undefined);
  return all;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockModules(overrides: Record<string, unknown> = {}): any {
  return {
    listTemplateItems: () => [],
    findTemplateDir: () => undefined,
    loadMetadata: () => ({ name: 'mock', fields: [], priority_fields: [] }),
    fillTemplate: async () => ({}),
    categoryFromId: () => 'general',
    sourceName: () => null,
    mapFields: (f: unknown[]) => f,
    exportTemplateToApap: () => ({}),
    fillApapAgreementToDocx: async () => ({}),
    ...overrides,
  };
}

describe('list_content / get_content (open-agreements#635)', () => {
  it('exposes both tools as read-only', () => {
    const descriptors = listToolDescriptors().filter(
      (tool) => tool.name === 'list_content' || tool.name === 'get_content',
    );
    expect(descriptors).toHaveLength(2);
    for (const descriptor of descriptors) {
      expect(descriptor.annotations).toEqual({ readOnlyHint: true, destructiveHint: false });
      expect(descriptor.inputSchema.additionalProperties).toBe(false);
    }
  });

  it('returns a compact paginated catalog in deterministic order', async () => {
    const result = await callTool('list_content', {});
    expect(result.isError).toBeUndefined();
    const payload = getPayload(result);
    expect(payload.ok).toBe(true);
    expect(payload.tool).toBe('list_content');

    const data = getData(result);
    const items = data.items as ContentEntry[];
    expect(items.length).toBe(25); // default page size, catalog is far larger
    expect(typeof data.total_count).toBe('number');
    expect((data.total_count as number)).toBeGreaterThan(25);
    expect(typeof data.next_cursor).toBe('string');
    // In a full repo checkout every content type is available.
    expect(data.unavailable_types).toBeUndefined();

    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(COMPACT_KEYS);
      expect(CONTENT_TYPES).toContain(item.type);
      expect(item.content_id.startsWith(`${item.type}/`)).toBe(true);
      expect(item.title.length).toBeGreaterThan(0);
    }

    const ids = items.map((item) => item.content_id);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });

  it('enumerates every content type without repository paths', async () => {
    for (const type of CONTENT_TYPES) {
      const result = await callTool('list_content', { type, limit: 100 });
      expect(result.isError).toBeUndefined();
      const data = getData(result);
      const items = data.items as ContentEntry[];
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.type === type)).toBe(true);
      expect(data.unavailable_types).toBeUndefined();
    }
  });

  it('marks markdown items with provenance-bearing metadata', async () => {
    const result = await callTool('list_content', { type: 'survey', limit: 100 });
    const items = getData(result).items as ContentEntry[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.format).toBe('markdown');
      expect(item.topic.length).toBeGreaterThan(0);
    }
    // Known stable survey from the repo bundle.
    expect(items.map((item) => item.content_id)).toContain('survey/wage-and-hour/us');
  });

  it('lists templates with docx_template format and template/ ids', async () => {
    const result = await callTool('list_content', { type: 'template', limit: 100 });
    const items = getData(result).items as ContentEntry[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.format).toBe('docx_template');
      expect(item.jurisdiction).toBeNull();
    }
    expect(items.map((item) => item.content_id)).toContain('template/common-paper-mutual-nda');
  });

  it('filters with query across compact fields, case-insensitively', async () => {
    const result = await callTool('list_content', { query: 'Wage-And-Hour', limit: 100 });
    expect(result.isError).toBeUndefined();
    const data = getData(result);
    const items = data.items as ContentEntry[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const haystack = [item.content_id, item.title, item.description ?? '', item.topic]
        .join('\n')
        .toLowerCase();
      expect(haystack).toContain('wage-and-hour');
    }
    const types = new Set(items.map((item) => item.type));
    expect(types.has('practice_guide')).toBe(true);
    expect(types.has('survey')).toBe(true);
  });

  it('returns an empty page (not an error) for a query with no matches', async () => {
    const result = await callTool('list_content', { query: 'zz-no-such-content-zz' });
    expect(result.isError).toBeUndefined();
    const data = getData(result);
    expect(data.items).toEqual([]);
    expect(data.total_count).toBe(0);
    expect(data.next_cursor).toBeNull();
  });

  it('paginates the full catalog without gaps or duplicates', async () => {
    const paged: ContentEntry[] = [];
    let cursor: string | undefined;
    let totalCount = 0;
    do {
      const args: Record<string, unknown> = { limit: 50 };
      if (cursor !== undefined) args.cursor = cursor;
      const result = await callTool('list_content', args);
      expect(result.isError).toBeUndefined();
      const data = getData(result);
      totalCount = data.total_count as number;
      paged.push(...(data.items as ContentEntry[]));
      cursor = (data.next_cursor as string | null) ?? undefined;
    } while (cursor !== undefined);

    expect(paged.length).toBe(totalCount);
    const ids = paged.map((item) => item.content_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);

    const single = await fetchFullContentCatalog();
    expect(single.map((item) => item.content_id)).toEqual(ids);
  });

  it('rejects malformed and beyond-tail cursors as INVALID_ARGUMENT', async () => {
    const malformedInputs = [
      '!!!not-base64!!!',
      Buffer.from('after:template/foo', 'utf8').toString('base64'), // legacy non-JSON shape
      Buffer.from('{"no_after":true}', 'utf8').toString('base64'),
      Buffer.from('{"after":""}', 'utf8').toString('base64'),
    ];
    for (const cursor of malformedInputs) {
      const result = await callTool('list_content', { cursor });
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('INVALID_ARGUMENT');
    }

    const beyondTail = await callTool('list_content', {
      cursor: Buffer.from(
        JSON.stringify({ after: 'zzzzzzzzzzzz', type: null, query: null }),
        'utf8',
      ).toString('base64'),
    });
    expect(beyondTail.isError).toBe(true);
    expect(getError(beyondTail).code).toBe('INVALID_ARGUMENT');
    expect(getError(beyondTail).message).toContain('beyond catalog tail');
  });

  it('rejects a cursor replayed under a different type or query filter', async () => {
    const firstPage = await callTool('list_content', { limit: 5 });
    const cursor = getData(firstPage).next_cursor as string;
    expect(typeof cursor).toBe('string');

    // Same (absent) filters: the cursor is valid.
    const samePage = await callTool('list_content', { cursor, limit: 5 });
    expect(samePage.isError).toBeUndefined();

    for (const args of [
      { cursor, type: 'practice_guide' },
      { cursor, query: 'wage-and-hour' },
    ]) {
      const result = await callTool('list_content', args);
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('INVALID_ARGUMENT');
      expect(getError(result).message).toContain('different type/query filter');
    }

    // And the reverse: a filtered cursor replayed unfiltered is rejected too.
    const filteredPage = await callTool('list_content', { type: 'checklist', limit: 5 });
    const filteredCursor = getData(filteredPage).next_cursor as string;
    expect(typeof filteredCursor).toBe('string');
    const unfilteredReplay = await callTool('list_content', { cursor: filteredCursor });
    expect(unfilteredReplay.isError).toBe(true);
    expect(getError(unfilteredReplay).code).toBe('INVALID_ARGUMENT');
  });

  it('meets per-type catalog floor counts in a full repo checkout', async () => {
    const floors: Record<string, number> = {
      template: 50,
      practice_guide: 100,
      checklist: 30,
      survey: 5,
    };
    for (const [type, floor] of Object.entries(floors)) {
      const result = await callTool('list_content', { type, limit: 1 });
      expect(result.isError).toBeUndefined();
      expect(getData(result).total_count as number).toBeGreaterThanOrEqual(floor);
    }
  });

  it('rejects invalid type, limit, query, and unknown arguments', async () => {
    const badInputs: Array<Record<string, unknown>> = [
      { type: 'blog_post' },
      { limit: 0 },
      { limit: 101 },
      { limit: 2.5 },
      { query: '' },
      { query: 'x'.repeat(201) },
      { unexpected: true },
    ];
    for (const args of badInputs) {
      const result = await callTool('list_content', args);
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('INVALID_ARGUMENT');
    }
  });

  it('returns the full canonical markdown document from get_content', async () => {
    const result = await callTool('get_content', { content_id: 'practice_guide/wage-and-hour/us' });
    expect(result.isError).toBeUndefined();
    const content = getData(result).content as Record<string, unknown>;
    expect(content.content_id).toBe('practice_guide/wage-and-hour/us');
    expect(content.type).toBe('practice_guide');
    expect(content.format).toBe('markdown');
    expect(content.topic).toBe('wage-and-hour');
    expect(content.jurisdiction).toBe('us');
    expect(content.source_url).toBe('https://openagreements.org/practice-guides/wage-and-hour/us');
    expect(content.repo_path).toBe('practice-guides/wage-and-hour/us.md');
    const markdown = content.markdown as string;
    expect(markdown).toContain('Fair Labor Standards Act');
    expect(markdown.length).toBeGreaterThan(1000);
  });

  it('resolves every listed markdown type through get_content', async () => {
    for (const type of DOC_CONTENT_TYPES) {
      const listing = await callTool('list_content', { type, limit: 1 });
      const [first] = getData(listing).items as ContentEntry[];
      expect(first).toBeDefined();
      const result = await callTool('get_content', { content_id: first.content_id });
      expect(result.isError).toBeUndefined();
      const content = getData(result).content as Record<string, unknown>;
      expect(content.content_id).toBe(first.content_id);
      expect(content.type).toBe(type);
      expect(content.title).toBe(first.title);
      expect((content.markdown as string).length).toBeGreaterThan(0);
    }
  });

  it('returns template content matching get_template', async () => {
    const result = await callTool('get_content', { content_id: 'template/common-paper-mutual-nda' });
    expect(result.isError).toBeUndefined();
    const content = getData(result).content as Record<string, unknown>;
    expect(content.type).toBe('template');
    expect(content.format).toBe('docx_template');

    const viaGetTemplate = await callTool('get_template', { template_id: 'common-paper-mutual-nda' });
    expect(content.template).toEqual(getData(viaGetTemplate).template);
  });

  it('returns CONTENT_NOT_FOUND for unknown, malformed, and traversal ids', async () => {
    const badIds = [
      'practice_guide/wage-and-hour/no-such-doc',
      'template/no-such-template',
      'no-slash-at-all',
      'blog_post/some/id',
      'practice_guide/wage-and-hour',
      'checklist/../../package',
      'survey/wage-and-hour/index',
      'survey/wage-and-hour/log',
    ];
    for (const contentId of badIds) {
      const result = await callTool('get_content', { content_id: contentId });
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('CONTENT_NOT_FOUND');
    }
  });

  it('rejects empty and oversized content ids as INVALID_ARGUMENT', async () => {
    for (const args of [{}, { content_id: '' }, { content_id: 'x'.repeat(513) }]) {
      const result = await callTool('get_content', args);
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('INVALID_ARGUMENT');
    }
  });

  describe('runtimes without local content bundles', () => {
    afterEach(() => {
      _resetModuleCache();
    });

    it('reports markdown types as unavailable with a reason instead of silently empty', async () => {
      _setModuleOverride(mockModules());
      const result = await callTool('list_content', {});
      expect(result.isError).toBeUndefined();
      const data = getData(result);
      expect(data.items).toEqual([]);
      expect(data.total_count).toBe(0);
      const unavailable = data.unavailable_types as Array<{ type: string; reason: string }>;
      expect(unavailable.map((entry) => entry.type)).toEqual([...DOC_CONTENT_TYPES]);
      for (const entry of unavailable) {
        expect(entry.reason).toContain('not shipped in the npm package');
      }
    });

    it('does not report unavailable types for a template-only listing', async () => {
      _setModuleOverride(
        mockModules({
          listTemplateItems: () => [
            { name: 'mock-template', display_name: 'Mock', category: 'general', description: 'd', fields: [] },
          ],
        }),
      );
      const result = await callTool('list_content', { type: 'template' });
      const data = getData(result);
      expect((data.items as ContentEntry[]).map((item) => item.content_id)).toEqual([
        'template/mock-template',
      ]);
      expect(data.unavailable_types).toBeUndefined();
    });

    it('reports empty available doc types as unavailable, not empty content', async () => {
      _setModuleOverride(
        mockModules({
          listDocContentItems: () => [],
          listDocContentTypesAvailable: () => [],
          findDocContentItem: () => undefined,
        }),
      );
      const result = await callTool('list_content', { type: 'checklist' });
      const data = getData(result);
      expect(data.items).toEqual([]);
      const unavailable = data.unavailable_types as Array<{ type: string }>;
      expect(unavailable.map((entry) => entry.type)).toEqual(['checklist']);
    });

    it('returns CONTENT_UNAVAILABLE from get_content for markdown content', async () => {
      _setModuleOverride(mockModules());
      const result = await callTool('get_content', { content_id: 'checklist/safes/yc-post-money-safe-valuation-cap' });
      expect(result.isError).toBe(true);
      expect(getError(result).code).toBe('CONTENT_UNAVAILABLE');
      expect((getError(result).message as string)).toContain('openagreements.org');
    });

    it('distinguishes unavailable types from missing content when partially available', async () => {
      const guide = {
        content_id: 'practice_guide/mock-topic/us',
        type: 'practice_guide',
        title: 'Mock Guide',
        description: null,
        topic: 'mock-topic',
        jurisdiction: 'us',
        format: 'markdown',
        source_url: null,
        updated_at: null,
        tags: [],
        repo_path: 'practice-guides/mock-topic/us.md',
      };
      _setModuleOverride(
        mockModules({
          listDocContentItems: () => [guide],
          listDocContentTypesAvailable: () => ['practice_guide'],
          findDocContentItem: (id: string) =>
            id === guide.content_id ? { ...guide, markdown: '# Mock Guide' } : undefined,
        }),
      );

      // list_content: only the absent bundles are reported unavailable.
      const listing = await callTool('list_content', {});
      const data = getData(listing);
      expect((data.items as ContentEntry[]).map((item) => item.content_id)).toEqual([
        guide.content_id,
      ]);
      expect((data.unavailable_types as Array<{ type: string }>).map((entry) => entry.type)).toEqual(
        ['checklist', 'survey'],
      );

      // get_content: absent bundle → CONTENT_UNAVAILABLE, not CONTENT_NOT_FOUND.
      const unavailable = await callTool('get_content', {
        content_id: 'checklist/safes/yc-post-money-safe-valuation-cap',
      });
      expect(unavailable.isError).toBe(true);
      expect(getError(unavailable).code).toBe('CONTENT_UNAVAILABLE');

      // get_content: available bundle, unknown doc → CONTENT_NOT_FOUND.
      const notFound = await callTool('get_content', { content_id: 'practice_guide/mock-topic/nowhere' });
      expect(notFound.isError).toBe(true);
      expect(getError(notFound).code).toBe('CONTENT_NOT_FOUND');

      // get_content: available bundle, known doc → full content.
      const found = await callTool('get_content', { content_id: guide.content_id });
      expect(found.isError).toBeUndefined();
      expect((getData(found).content as Record<string, unknown>).markdown).toBe('# Mock Guide');
    });
  });
});
