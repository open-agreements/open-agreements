import { afterEach, describe, expect, vi } from 'vitest';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface ContentEntry {
  id: string;
  dir: string;
  baseDir: string;
}

interface TemplateMeta {
  name: string;
  description?: string;
  license: string;
  source_url: string;
  attribution_text: string;
  fields: Array<{
    name: string;
    type: string;
    description: string;
    section?: string;
    default?: string;
    items?: Array<{ name: string; type: string; description: string; section?: string; default?: string }>;
  }>;
  priority_fields: string[];
  credits?: Array<{ name: string; role: string; profile_url?: string }>;
  derived_from?: string;
}

interface RecipeMeta {
  name: string;
  description?: string;
  source_url: string;
  source_version: string;
  license_note: string;
  optional: boolean;
  fields: Array<{ name: string; type: string; description: string; section?: string; default?: string }>;
  priority_fields: string[];
}

interface ListHarnessOptions {
  templateEntries?: ContentEntry[];
  externalEntries?: ContentEntry[];
  recipeEntries?: ContentEntry[];
  templateByDir?: Record<string, TemplateMeta | Error>;
  externalByDir?: Record<string, TemplateMeta | Error>;
  recipeByDir?: Record<string, RecipeMeta | Error>;
}

interface ListHarness {
  runList: (opts?: { json?: boolean; jsonStrict?: boolean }) => void;
  spies: {
    listTemplateEntries: ReturnType<typeof vi.fn>;
    listExternalEntries: ReturnType<typeof vi.fn>;
    listRecipeEntries: ReturnType<typeof vi.fn>;
    loadMetadata: ReturnType<typeof vi.fn>;
    loadExternalMetadata: ReturnType<typeof vi.fn>;
    loadRecipeMetadata: ReturnType<typeof vi.fn>;
  };
}

const itDiscovery = itAllure.epic('Discovery & Metadata');

function baseFields() {
  return [
    { name: 'company_name', type: 'string', description: 'Company legal name' },
    { name: 'effective_date', type: 'date', description: 'Effective date', default: '2026-02-12' },
  ];
}

function templateMeta(name: string, sourceUrl: string): TemplateMeta {
  return {
    name,
    description: `${name} description`,
    license: 'CC-BY-4.0',
    source_url: sourceUrl,
    attribution_text: `${name} attribution`,
    fields: baseFields(),
    priority_fields: ['company_name'],
  };
}

function recipeMeta(name: string, sourceUrl: string): RecipeMeta {
  return {
    name,
    description: `${name} recipe description`,
    source_url: sourceUrl,
    source_version: 'v2.0',
    license_note: 'Use per source license',
    optional: false,
    fields: baseFields(),
    priority_fields: ['company_name'],
  };
}

async function loadListHarness(opts: ListHarnessOptions = {}): Promise<ListHarness> {
  vi.resetModules();

  const listTemplateEntries = vi.fn(() => opts.templateEntries ?? []);
  const listExternalEntries = vi.fn(() => opts.externalEntries ?? []);
  const listRecipeEntries = vi.fn(() => opts.recipeEntries ?? []);

  const loadMetadata = vi.fn((dir: string) => {
    const value = opts.templateByDir?.[dir] ?? templateMeta('Fallback Template', 'https://commonpaper.com/template');
    if (value instanceof Error) throw value;
    return value;
  });

  const loadExternalMetadata = vi.fn((dir: string) => {
    const value = opts.externalByDir?.[dir] ?? templateMeta('Fallback External', 'https://ycombinator.com/safe');
    if (value instanceof Error) throw value;
    return value;
  });

  const loadRecipeMetadata = vi.fn((dir: string) => {
    const value = opts.recipeByDir?.[dir] ?? recipeMeta('Fallback Recipe', 'https://nvca.org/forms');
    if (value instanceof Error) throw value;
    return value;
  });

  vi.doMock('../src/utils/paths.js', () => ({
    listTemplateEntries,
    listExternalEntries,
    listRecipeEntries,
  }));

  vi.doMock('../src/core/metadata.js', () => ({
    loadMetadata,
    loadExternalMetadata,
    loadRecipeMetadata,
  }));

  const { runList } = await import('../src/commands/list.js');
  return {
    runList,
    spies: {
      listTemplateEntries,
      listExternalEntries,
      listRecipeEntries,
      loadMetadata,
      loadExternalMetadata,
      loadRecipeMetadata,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('runList in-process coverage', () => {
  itDiscovery.openspec('OA-CLI-012')('emits sorted JSON envelope with normalized sources and mapped fields', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'z-template', dir: '/templates/z-template', baseDir: '/templates' },
        { id: 'a-template', dir: '/templates/a-template', baseDir: '/templates' },
      ],
      externalEntries: [
        { id: 'b-external', dir: '/external/b-external', baseDir: '/external' },
      ],
      recipeEntries: [
        { id: 'c-recipe', dir: '/recipes/c-recipe', baseDir: '/recipes' },
      ],
      templateByDir: {
        '/templates/z-template': templateMeta('Z Template', 'https://www.commonpaper.com/doc'),
        '/templates/a-template': templateMeta('A Template', 'not a valid url'),
      },
      externalByDir: {
        '/external/b-external': templateMeta('B External', 'https://example.org/source'),
      },
      recipeByDir: {
        '/recipes/c-recipe': recipeMeta('C Recipe', 'https://nvca.org/model-docs'),
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run list in JSON mode', async () => {
      harness.runList({ json: true });
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(String(logSpy.mock.calls[0][0]));
    const names = envelope.items.map((item: { name: string }) => item.name);

    await allureJsonAttachment('list-json-envelope.json', envelope);
    await allureJsonAttachment('list-json-expected-vs-actual.json', {
      expectedSortedNames: ['a-template', 'b-external', 'c-recipe', 'z-template'],
      actualSortedNames: names,
      expectedSources: {
        'z-template': 'Common Paper',
        'a-template': null,
        'b-external': 'example.org',
        'c-recipe': 'NVCA',
      },
      actualSources: Object.fromEntries(
        envelope.items.map((item: { name: string; source: string | null }) => [item.name, item.source])
      ),
    });

    expect(names).toEqual(['a-template', 'b-external', 'c-recipe', 'z-template']);

    const zTemplate = envelope.items.find((item: { name: string }) => item.name === 'z-template');
    const aTemplate = envelope.items.find((item: { name: string }) => item.name === 'a-template');
    expect(zTemplate.source).toBe('Common Paper');
    expect(aTemplate.source).toBeNull();

    expect(zTemplate.fields[0]).toMatchObject({
      name: 'company_name',
      required: true,
      section: null,
      default: null,
    });
    expect(zTemplate.fields[1]).toMatchObject({
      name: 'effective_date',
      required: false,
      default: '2026-02-12',
    });
  });

  itDiscovery.openspec('OA-CLI-013')('exits non-zero in --json-strict mode when metadata loading fails', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'bad-template', dir: '/templates/bad-template', baseDir: '/templates' },
      ],
      templateByDir: {
        '/templates/bad-template': new Error('metadata parse failed'),
      },
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`EXIT_${code ?? 0}`);
      }) as never);

    await allureStep('Run list in JSON strict mode', async () => {
      expect(() => harness.runList({ jsonStrict: true })).toThrow('EXIT_1');
    });

    await allureJsonAttachment('list-json-strict-errors.json', {
      stderrCalls: errorSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: template bad-template: metadata parse failed'));
  });

  itDiscovery.openspec('OA-CLI-024')('preserves nested array item schemas in JSON output', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'array-template', dir: '/templates/array-template', baseDir: '/templates' },
      ],
      templateByDir: {
        '/templates/array-template': {
          ...templateMeta('Array Template', 'https://example.com/array-template'),
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
        },
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run list in JSON mode for array item schema', async () => {
      harness.runList({ json: true });
    });

    const envelope = JSON.parse(String(logSpy.mock.calls[0][0]));
    await allureJsonAttachment('list-json-array-item-schema.json', envelope);

    const template = envelope.items.find((item: { name: string }) => item.name === 'array-template');
    expect(template.fields).toHaveLength(1);
    expect(template.fields[0]).toMatchObject({
      name: 'signers',
      type: 'array',
      required: false,
    });
    expect(template.fields[0].items).toEqual([
      {
        name: 'name',
        type: 'string',
        required: false,
        section: null,
        description: 'Printed signer name',
        default: null,
        default_value_rationale: null,
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        section: null,
        description: 'Printed signer title',
        default: '',
        default_value_rationale: null,
      },
    ]);
  });

  itDiscovery.openspec('OA-TMP-039')('projects credits and derived_from onto internal and external templates; omits them on recipes', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'credited-template', dir: '/templates/credited-template', baseDir: '/templates' },
        { id: 'plain-template', dir: '/templates/plain-template', baseDir: '/templates' },
      ],
      externalEntries: [
        { id: 'plain-external', dir: '/external/plain-external', baseDir: '/external' },
      ],
      recipeEntries: [
        { id: 'plain-recipe', dir: '/recipes/plain-recipe', baseDir: '/recipes' },
      ],
      templateByDir: {
        '/templates/credited-template': {
          ...templateMeta('Credited Template', 'https://example.com/credited'),
          credits: [
            {
              name: 'Joey Tsang',
              role: 'drafting_editor',
              profile_url: 'https://www.linkedin.com/in/joey-t-b90912b1/',
            },
          ],
          derived_from: 'Publicly available Series Seed SAFE board consent materials',
        },
        '/templates/plain-template': templateMeta('Plain Template', 'https://example.com/plain'),
      },
      externalByDir: {
        '/external/plain-external': templateMeta('Plain External', 'https://example.org/plain'),
      },
      recipeByDir: {
        '/recipes/plain-recipe': recipeMeta('Plain Recipe', 'https://nvca.org/plain'),
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run list in JSON mode for credits projection', async () => {
      harness.runList({ json: true });
    });

    const envelope = JSON.parse(String(logSpy.mock.calls[0][0]));
    await allureJsonAttachment('list-json-credits-projection.json', envelope);

    const credited = envelope.items.find((i: { name: string }) => i.name === 'credited-template');
    expect(credited.credits).toEqual([
      {
        name: 'Joey Tsang',
        role: 'drafting_editor',
        profile_url: 'https://www.linkedin.com/in/joey-t-b90912b1/',
      },
    ]);
    expect(credited.derived_from).toBe('Publicly available Series Seed SAFE board consent materials');

    const plainTemplate = envelope.items.find((i: { name: string }) => i.name === 'plain-template');
    expect(plainTemplate.credits).toEqual([]);
    expect(plainTemplate.derived_from).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(plainTemplate, 'derived_from')).toBe(false);

    const plainExternal = envelope.items.find((i: { name: string }) => i.name === 'plain-external');
    expect(plainExternal.credits).toEqual([]);
    expect(plainExternal.derived_from).toBeUndefined();

    const plainRecipe = envelope.items.find((i: { name: string }) => i.name === 'plain-recipe');
    expect(plainRecipe.credits).toBeUndefined();
    expect(plainRecipe.derived_from).toBeUndefined();
  });

  itDiscovery.openspec('OA-TMP-036').skip('parse-time validation lives in the metadata loader; covered indirectly by list/fill flows that call loadMetadata, but a direct unit test is pending', () => {});

  itDiscovery.openspec('OA-TMP-037').skip('default-empty-array behavior is enforced by the schema and exercised indirectly via list-command projection above; direct unit test is pending', () => {});

  itDiscovery.openspec('OA-TMP-038').skip('invalid-role rejection is enforced by the metadata schema; a direct negative test is pending', () => {});

  itDiscovery('collects external and recipe metadata errors in non-strict JSON mode', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'good-template', dir: '/templates/good-template', baseDir: '/templates' },
      ],
      externalEntries: [
        { id: 'bad-external', dir: '/external/bad-external', baseDir: '/external' },
      ],
      recipeEntries: [
        { id: 'bad-recipe', dir: '/recipes/bad-recipe', baseDir: '/recipes' },
      ],
      templateByDir: {
        '/templates/good-template': templateMeta('Good Template', 'https://commonpaper.com/good'),
      },
      externalByDir: {
        '/external/bad-external': new Error('external metadata parse failed'),
      },
      recipeByDir: {
        '/recipes/bad-recipe': new Error('recipe metadata parse failed'),
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    harness.runList({ json: true });

    expect(errorSpy).not.toHaveBeenCalled();
    const envelope = JSON.parse(String(logSpy.mock.calls[0][0]));
    await allureJsonAttachment('list-json-non-strict-errors-envelope.json', envelope);
    expect(envelope.items).toHaveLength(1);
    expect(envelope.items[0].name).toBe('good-template');
  });

  itDiscovery.openspec('OA-CLI-004')('renders human-readable table rows with error placeholders when metadata fails', async () => {
    const harness = await loadListHarness({
      templateEntries: [
        { id: 'good-template', dir: '/templates/good-template', baseDir: '/templates' },
        { id: 'bad-template', dir: '/templates/bad-template', baseDir: '/templates' },
      ],
      templateByDir: {
        '/templates/good-template': templateMeta('Good Template', 'https://bonterms.com/form'),
        '/templates/bad-template': new Error('invalid metadata payload'),
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await allureStep('Run list in default human-readable mode', async () => {
      harness.runList();
    });

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    await allureJsonAttachment('list-human-output-check.json', {
      output,
      expectedContains: ['Agreement', 'good-template', 'bad-template', 'ERROR', 'Could not load metadata'],
    });

    expect(output).toContain('Agreement');
    expect(output).toContain('good-template');
    expect(output).toContain('bad-template');
    expect(output).toContain('ERROR');
    expect(output).toContain('Could not load metadata');
  });

  itDiscovery('renders external and recipe rows with success and error states in human-readable output', async () => {
    const harness = await loadListHarness({
      templateEntries: [],
      externalEntries: [
        { id: 'good-external', dir: '/external/good-external', baseDir: '/external' },
        { id: 'bad-external', dir: '/external/bad-external', baseDir: '/external' },
      ],
      recipeEntries: [
        { id: 'good-recipe', dir: '/recipes/good-recipe', baseDir: '/recipes' },
        { id: 'bad-recipe', dir: '/recipes/bad-recipe', baseDir: '/recipes' },
      ],
      externalByDir: {
        '/external/good-external': templateMeta('Good External', 'https://ycombinator.com/safe'),
        '/external/bad-external': new Error('bad external metadata'),
      },
      recipeByDir: {
        '/recipes/good-recipe': {
          ...recipeMeta('Good Recipe', 'https://nvca.org/good-recipe'),
          optional: true,
        },
        '/recipes/bad-recipe': new Error('bad recipe metadata'),
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    harness.runList();

    const output = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    await allureJsonAttachment('list-human-external-recipe-rows.json', { output });
    expect(output).toContain('good-external');
    expect(output).toContain('good-recipe');
    expect(output).toContain('recipe*');
    expect(output).toContain('bad-external');
    expect(output).toContain('bad-recipe');
    expect(output).toContain('Could not load metadata');
  });

  itDiscovery('prints no agreements message when all sources are empty', async () => {
    const harness = await loadListHarness({
      templateEntries: [],
      externalEntries: [],
      recipeEntries: [],
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    harness.runList({});

    expect(logSpy).toHaveBeenCalledWith('No agreements found.');
  });
});
