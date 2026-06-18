import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { resolveRecipeDir } from '../src/utils/paths.js';
import { loadCleanConfig, loadRecipeMetadata } from '../src/core/metadata.js';
import replacements from '../content/recipes/nvca-stock-purchase-agreement/replacements.json' with { type: 'json' };
import { cleanDocument } from '../src/core/recipe/cleaner.js';
import { patchDocument } from '../src/core/recipe/patcher.js';
import {
  loadSelectorContracts,
  applySelectorContracts,
  resolveSelectorContracts,
  type FieldSelectorManifest,
} from '../src/core/selectors/index.js';

const it = itAllure.epic('Recipes');

const COMPANY_MANIFEST: FieldSelectorManifest = {
  schema_version: 1,
  field_id: 'company_name',
  field_label: 'Company Name',
  description: '',
  source_template_version: '10-28-2025',
  occurrences: [
    { primary: { kind: 'regex', pattern: '\\[Insert Company Name\\]' } },
    { primary: { kind: 'regex', pattern: '\\[Company name\\]' } },
    {
      scope: [{ kind: 'section', headingRegex: 'PREFERRED STOCK PURCHASE AGREEMENT' }],
      primary: { kind: 'regex', pattern: '\\[____________\\]' },
    },
  ],
  postconditions: ['no_unresolved_placeholder', 'all_occurrences_identical', 'no_double_dollar'],
  failure_behavior: 'warn',
  fixtures: [],
};

const COMPANY_KEYS: Record<string, string> = {
  '[Insert Company Name]': '{company_name}',
  '[Company name]': '{company_name}',
  '[____________]': '{company_name}',
};

function textOf(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf-8');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

function cachedSourcePath(): string {
  return join(homedir(), '.open-agreements', 'cache', 'nvca-stock-purchase-agreement', 'source.docx');
}

describe('loadSelectorContracts', () => {
  it.openspec('OA-SEL-009')('[OA-SEL-009] returns nothing for a recipe with no fields/ directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'recipe-no-fields-'));
    try {
      const { manifests, templateManifest } = loadSelectorContracts(dir, ['company_name']);
      expect(manifests).toEqual([]);
      expect(templateManifest).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.openspec('OA-SEL-002')('[OA-SEL-002] rejects a manifest whose field_id is not in metadata.yaml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'recipe-bad-field-'));
    try {
      mkdirSync(join(dir, 'fields'));
      writeFileSync(
        join(dir, 'fields', 'not_a_field.json'),
        JSON.stringify({ ...COMPANY_MANIFEST, field_id: 'not_a_field' }),
      );
      expect(() => loadSelectorContracts(dir, ['company_name'])).toThrow(/not a field in metadata\.yaml/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads every real nvca SPA field manifest + template manifest', () => {
    const recipeDir = resolveRecipeDir('nvca-stock-purchase-agreement');
    const fieldNames = loadRecipeMetadata(recipeDir).fields.map((f) => f.name);
    const { manifests, templateManifest } = loadSelectorContracts(recipeDir, fieldNames);
    expect(manifests.map((m) => m.field_id).sort()).toEqual([
      'agreement_date_month_day',
      'agreement_year_two_digits',
      'company_name',
      'investor_counsel',
      'minimum_shares_initial_closing',
      'optional_plural_suffix',
      'par_value_per_share',
      'purchase_price_per_share',
      'series_designation',
    ]);
    // company_name (3) + the 13 migrated `>` keys = 16
    expect(templateManifest?.migrated_keys).toHaveLength(16);
    expect(templateManifest?.migrated_keys).toEqual(
      expect.arrayContaining([
        '[Insert Company Name]',
        'SERIES > [___]',
        'such Series > [__]',
        'is made as of > [________]',
        'A minimum of > [_______]',
        'expenses of > [_______]',
      ]),
    );
    // every migrated key is a real replacements.json key (no typos / drift)
    for (const key of templateManifest!.migrated_keys) {
      expect(replacements, `migrated key ${JSON.stringify(key)} missing from replacements.json`).toHaveProperty([key]);
    }
  });
});

const describeWithSource = existsSync(cachedSourcePath()) ? describe : describe.skip;

describeWithSource('selector contracts against the real NVCA source', () => {
  it('all three company_name occurrences resolve against the source', async () => {
    const { fields } = await resolveSelectorContracts(cachedSourcePath(), [COMPANY_MANIFEST]);
    expect(fields[0].field_id).toBe('company_name');
    expect(fields[0].unresolved).toBe(false);
    expect(fields[0].occurrences.every((o) => !o.resolution.unresolved)).toBe(true);
  });

  it.openspec('OA-SEL-010')('[OA-SEL-010] selector-patched coverage matches legacy replacement-patched coverage for company_name', async () => {
    const recipeDir = resolveRecipeDir('nvca-stock-purchase-agreement');
    const cleanConfig = loadCleanConfig(recipeDir);
    const dir = mkdtempSync(join(tmpdir(), 'selector-parity-'));
    try {
      const cleaned = join(dir, 'cleaned.docx');
      await cleanDocument(cachedSourcePath(), cleaned, cleanConfig);

      // Legacy path: literal global replace of the three company keys.
      const legacy = join(dir, 'legacy.docx');
      await patchDocument(cleaned, legacy, COMPANY_KEYS);

      // Selector path: deterministic locators rewrite the same spots.
      const selector = join(dir, 'selector.docx');
      await applySelectorContracts(cleaned, selector, [COMPANY_MANIFEST]);

      const legacyText = textOf(legacy);
      const selectorText = textOf(selector);

      for (const anchor of Object.keys(COMPANY_KEYS)) {
        expect(legacyText.includes(anchor), `legacy still has ${anchor}`).toBe(false);
        expect(selectorText.includes(anchor), `selector still has ${anchor}`).toBe(false);
      }
      const legacyTags = (legacyText.match(/\{company_name\}/g) ?? []).length;
      const selectorTags = (selectorText.match(/\{company_name\}/g) ?? []).length;
      expect(legacyTags).toBe(3);
      expect(selectorTags).toBe(legacyTags);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Per-field migration parity for the `>`-anchor keys migrated in #476. For each field we assert the
// STRONGEST possible gate: the whole-document text after selector-patching ONLY that field is byte-for-byte
// identical to the text after legacy-patching ONLY that field's `>` keys. Equal tag counts are not enough —
// a selector could place a tag in the wrong span and still match a count, which matters for the 12
// near-identical `series_designation` blanks. We also confirm every occurrence resolves against the raw
// source (the drift-canary surface), not just the cleaned doc.
const MIGRATED_SPAN_COUNTS: Record<string, number> = {
  series_designation: 12,
  agreement_date_month_day: 1,
  agreement_year_two_digits: 1,
  par_value_per_share: 1,
  purchase_price_per_share: 1,
  optional_plural_suffix: 1,
  minimum_shares_initial_closing: 2,
  investor_counsel: 1,
};

describeWithSource('SPA `>`-anchor field migration parity (#476)', () => {
  const recipeDir = resolveRecipeDir('nvca-stock-purchase-agreement');
  const fieldNames = loadRecipeMetadata(recipeDir).fields.map((f) => f.name);
  const { manifests, templateManifest } = loadSelectorContracts(recipeDir, fieldNames);
  const migratedKeys = new Set(templateManifest?.migrated_keys ?? []);
  const manifestById = new Map(manifests.map((m) => [m.field_id, m]));
  // legacy `>` keys grouped by the field_id they target ({field_id} value), restricted to migrated keys.
  const legacyKeysByField = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(replacements as Record<string, string>)) {
    if (!migratedKeys.has(key) || !key.includes('>')) continue;
    const field = value.replace(/^\{|\}$/g, '');
    legacyKeysByField.set(field, { ...(legacyKeysByField.get(field) ?? {}), [key]: value });
  }

  for (const [field, expectedSpans] of Object.entries(MIGRATED_SPAN_COUNTS)) {
    it(`[${field}] selector patch is byte-identical to legacy \`>\` patch (${expectedSpans} span(s))`, async () => {
      const manifest = manifestById.get(field)!;
      const legacyKeys = legacyKeysByField.get(field)!;
      expect(manifest, `no manifest loaded for ${field}`).toBeDefined();
      expect(Object.keys(legacyKeys).length, `no migrated legacy keys for ${field}`).toBeGreaterThan(0);

      // Drift surface: every occurrence must resolve against the raw source.
      const rawRes = await resolveSelectorContracts(cachedSourcePath(), [manifest]);
      expect(rawRes.fields[0].unresolved, `${field} unresolved against raw source`).toBe(false);

      const dir = mkdtempSync(join(tmpdir(), `selector-parity-${field}-`));
      try {
        const cleaned = join(dir, 'cleaned.docx');
        await cleanDocument(cachedSourcePath(), cleaned, loadCleanConfig(recipeDir));

        const legacy = join(dir, 'legacy.docx');
        await patchDocument(cleaned, legacy, legacyKeys);

        const selector = join(dir, 'selector.docx');
        await applySelectorContracts(cleaned, selector, [manifest]);

        const legacyText = textOf(legacy);
        const selectorText = textOf(selector);
        const tag = new RegExp(`\\{${field}\\}`, 'g');
        expect((legacyText.match(tag) ?? []).length).toBe(expectedSpans);
        // The strong gate: identical whole-document text ⇒ selector hit the exact legacy spans.
        expect(selectorText).toBe(legacyText);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
