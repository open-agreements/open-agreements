import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { loadCleanConfig, loadFieldSelectorMetadata } from '../src/core/metadata.js';
import replacements from '../templates/nvca-free-non-redistributable/nvca-stock-purchase-agreement/replacements.json' with { type: 'json' };
import coiReplacements from '../templates/nvca-free-non-redistributable/nvca-certificate-of-incorporation/replacements.json' with { type: 'json' };
import { cleanDocument } from '../src/core/field-selector/cleaner.js';
import { patchDocument } from '../src/core/field-selector/patcher.js';
import {
  loadSelectorContracts,
  applySelectorContracts,
  resolveSelectorContracts,
  type FieldSelectorManifest,
} from '../src/core/selectors/index.js';

const it = itAllure.epic('FieldSelectors');

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

function cachedSourcePathFor(fieldSelectorId: string): string {
  return join(homedir(), '.open-agreements', 'cache', fieldSelectorId, 'source.docx');
}

function cachedSourcePath(): string {
  return cachedSourcePathFor('nvca-stock-purchase-agreement');
}

/** First `{field_id}` tag in a replacement value (CoI values may carry trailing literal text). */
function fieldOfValue(value: string): string | null {
  return value.match(/\{([a-zA-Z0-9_]+)\}/)?.[1] ?? null;
}

describe('loadSelectorContracts', () => {
  it('[OA-SEL-009] returns nothing for a fieldSelector with no fields/ directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'field-selector-no-fields-'));
    try {
      const { manifests, templateManifest } = loadSelectorContracts(dir, ['company_name']);
      expect(manifests).toEqual([]);
      expect(templateManifest).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('[OA-SEL-002] rejects a manifest whose field_id is not in metadata.yaml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'field-selector-bad-field-'));
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
    const fieldSelectorDir = resolveFieldSelectorDir('nvca-stock-purchase-agreement');
    const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
    const { manifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, fieldNames);
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

  it('[OA-SEL-010] selector-patched coverage matches legacy replacement-patched coverage for company_name', async () => {
    const fieldSelectorDir = resolveFieldSelectorDir('nvca-stock-purchase-agreement');
    const cleanConfig = loadCleanConfig(fieldSelectorDir);
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
  const fieldSelectorDir = resolveFieldSelectorDir('nvca-stock-purchase-agreement');
  const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
  const { manifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, fieldNames);
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
        await cleanDocument(cachedSourcePath(), cleaned, loadCleanConfig(fieldSelectorDir));

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

// ---------------------------------------------------------------------------
// NVCA Certificate of Incorporation (CoI) `>`-anchor migration.
//
// The CoI's auto-generated replacements.json is messier than the SPA's: many `>` keys are dead
// duplicates (their bracketed context never co-locates with the target, so the legacy
// `replaceFirstAfterContext` never fires) and several fields are actually filled by a co-located
// SIMPLE (non-`>`) key. So `migrated_keys` groups by the field a key targets (the first `{tag}` in
// its value), spanning both `>` and simple keys. Two fields are PARTIALLY migrated (only their
// byte-parity-expressible occurrence): `series_designation` and `strategic_partnership_exception_shares`.
// Fields whose every fill rewrites surrounding literal text (`liquidation_preference_multiple`,
// `dividend_formula_prefix`), a span crossing a Word field (`no_redemption_clause`), a computed
// non-metadata field (`or_officer_clause`), or an irreducibly-ambiguous fill point (`initial_purchase_price`
// — the same blank sits in a byte-identical sentence across the three mutually-exclusive dividend-variant
// paragraphs, so the only disambiguator is far-away paragraph context, which makes for a brittle anchor)
// are deliberately left on the legacy path — see PR scope.
// ---------------------------------------------------------------------------
const COI = 'nvca-certificate-of-incorporation';

describe('loadSelectorContracts (CoI)', () => {
  it('loads every real nvca CoI field manifest + template manifest', () => {
    const fieldSelectorDir = resolveFieldSelectorDir(COI);
    const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
    const { manifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, fieldNames);
    // 27 fields migrated (content-only); see header note for the deferrals.
    expect(manifests).toHaveLength(27);
    expect(templateManifest?.migrated_keys).toHaveLength(69);
    // every field_id is a real metadata field (loadSelectorContracts already enforces this, but assert
    // the join key explicitly) and every migrated key is a real replacements.json key (no drift/typos).
    const metaFields = new Set(fieldNames);
    for (const m of manifests) {
      expect(metaFields, `${m.field_id} not in metadata.yaml`).toContain(m.field_id);
    }
    for (const key of templateManifest!.migrated_keys) {
      expect(coiReplacements, `migrated key ${JSON.stringify(key)} missing`).toHaveProperty([key]);
    }
    // every migrated key resolves to exactly one of the 28 manifest fields via its first `{tag}`.
    const manifestIds = new Set(manifests.map((m) => m.field_id));
    for (const key of templateManifest!.migrated_keys) {
      const field = fieldOfValue((coiReplacements as Record<string, string>)[key]);
      expect(manifestIds, `migrated key ${JSON.stringify(key)} → ${field}`).toContain(field);
    }
  });
});

const describeWithCoiSource = existsSync(cachedSourcePathFor(COI)) ? describe : describe.skip;

describeWithCoiSource('CoI `>`-anchor field migration parity', () => {
  const fieldSelectorDir = resolveFieldSelectorDir(COI);
  const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
  const { manifests, templateManifest } = loadSelectorContracts(fieldSelectorDir, fieldNames);
  const migratedKeys = new Set(templateManifest?.migrated_keys ?? []);
  // All migrated keys (>'s AND simple) grouped by the field they target (first `{tag}` in the value).
  const legacyKeysByField = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(coiReplacements as Record<string, string>)) {
    if (!migratedKeys.has(key)) continue;
    const field = fieldOfValue(value);
    if (!field) continue;
    legacyKeysByField.set(field, { ...(legacyKeysByField.get(field) ?? {}), [key]: value });
  }

  for (const manifest of manifests) {
    const field = manifest.field_id;
    const expectedSpans = manifest.occurrences.length;
    it(`[${field}] selector patch is byte-identical to legacy patch (${expectedSpans} span(s))`, async () => {
      const legacyKeys = legacyKeysByField.get(field)!;
      expect(legacyKeys, `no migrated legacy keys for ${field}`).toBeDefined();

      // Drift surface: every occurrence must resolve against the raw source.
      const rawRes = await resolveSelectorContracts(cachedSourcePathFor(COI), [manifest]);
      expect(rawRes.fields[0].unresolved, `${field} unresolved against raw source`).toBe(false);
      expect(rawRes.fields[0].assertionFailures, `${field} assertion failures`).toHaveLength(0);

      const dir = mkdtempSync(join(tmpdir(), `coi-parity-${field}-`));
      try {
        const cleaned = join(dir, 'cleaned.docx');
        await cleanDocument(cachedSourcePathFor(COI), cleaned, loadCleanConfig(fieldSelectorDir));

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
