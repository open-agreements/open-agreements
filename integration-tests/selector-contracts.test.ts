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
import { runFieldSelector } from '../src/core/field-selector/index.js';
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
    // 28 field manifests; see header note for the deferrals. `original_incorporation_date` and
    // `effective_date` (#608) are pure selector-contracts with NO migrated legacy keys — the 5 recital
    // `[________ __, 20__]` keys that formerly backed `effective_date` were removed from both
    // replacements.json and migrated_keys, so the migrated count drops from 69 to 64.
    expect(manifests).toHaveLength(28);
    expect(templateManifest?.migrated_keys).toHaveLength(64);
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

  // Fields with no legacy counterpart are excluded from the byte-identity gate and covered by their
  // own dedicated tests below:
  //  - `company_name` (#607): its caption (`INCORPORATIONOF > [_________]`) and opening-recital
  //    (`[____________], a corporation > [____________]`) legacy `>` keys are dead duplicates — the
  //    legacy `replaceFirstAfterContext` never fires them (the caption context has no space before the
  //    blank; the recital context IS the target blank) — so legacy fills only the two body occurrences.
  //    The selector correctly fills all four, which is exactly the bug #607 fixes.
  //  - `original_incorporation_date` / `effective_date` (#608): pure selector-contract fields with NO
  //    migrated legacy keys and NO `replacements.json` entries. They are date-typed, and prepareFillData
  //    renders ISO input as a display date; keeping them in the legacy value-map would make the runtime
  //    verifier compare raw ISO input against the formatted output. They are covered end-to-end below.
  const noLegacyParity = new Set(['company_name', 'original_incorporation_date', 'effective_date']);
  for (const manifest of manifests.filter((m) => !noLegacyParity.has(m.field_id))) {
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

// ---------------------------------------------------------------------------
// CoI `company_name` — all four occurrences (#607).
//
// The pre-#607 selector declared only the two body occurrences ("name of this corporation is
// [_______________]"). The caption ("CERTIFICATE OF INCORPORATIONOF[_________]") and opening recital
// ("[____________], a corporation ...") were owned by migrated `>` keys that the legacy patcher never
// fills (dead duplicates — see the note on the parity loop above), so they fell through BOTH paths and
// rendered as raw `[_________]` / `[____________]` placeholders. This asserts the selector now fills every
// company-name occurrence represented by the migrated keys: caption + opening recital + both body spans.
// ---------------------------------------------------------------------------
describeWithCoiSource('CoI company_name covers all four occurrences (#607)', () => {
  const fieldSelectorDir = resolveFieldSelectorDir(COI);
  const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
  const { manifests } = loadSelectorContracts(fieldSelectorDir, fieldNames);
  const manifest = manifests.find((m) => m.field_id === 'company_name')!;

  it('[company_name] fills the caption, opening recital, and both body occurrences', async () => {
    expect(manifest, 'company_name manifest not loaded').toBeDefined();
    expect(manifest.occurrences).toHaveLength(4);

    // Drift surface: all four occurrences resolve uniquely against the raw source.
    const raw = await resolveSelectorContracts(cachedSourcePathFor(COI), [manifest]);
    expect(raw.fields[0].unresolved, 'company_name unresolved against raw source').toBe(false);
    expect(raw.fields[0].assertionFailures, 'company_name assertion failures').toHaveLength(0);
    expect(raw.fields[0].occurrences.map((o) => o.resolution.unresolved)).toEqual([false, false, false, false]);

    const dir = mkdtempSync(join(tmpdir(), 'coi-company-name-607-'));
    try {
      const cleaned = join(dir, 'cleaned.docx');
      await cleanDocument(cachedSourcePathFor(COI), cleaned, loadCleanConfig(fieldSelectorDir));

      const selector = join(dir, 'selector.docx');
      await applySelectorContracts(cleaned, selector, [manifest]);

      const text = textOf(selector);
      // Exactly four company_name tags — caption + recital + two body.
      expect((text.match(/\{company_name\}/g) ?? []).length).toBe(4);
      // Caption: "...CERTIFICATE OF INCORPORATIONOF{company_name}" (was [_________]).
      expect(text).toContain('INCORPORATIONOF{company_name}');
      // Opening recital: "{company_name}, a corporation" (was [____________]).
      expect(text).toContain('{company_name}, a corporation');
      // Both body occurrences still filled.
      expect((text.match(/name of this corporation is \{company_name\}/g) ?? []).length).toBe(2);
      // The caption and recital source placeholders are gone.
      expect(text.includes('[_________]'), 'caption placeholder still present').toBe(false);
      expect(text.includes('[____________]'), 'recital placeholder still present').toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// CoI original_incorporation_date vs effective_date (#608).
//
// The historical recital date ("originally incorporated ... on [________ __, 20__]") and the charter's
// execution/effective date ("executed by a duly authorized officer of this corporation on ___________")
// are DISTINCT slots. Pre-#608 the single `effective_date` field targeted the recital and rendered ISO
// input verbatim. This asserts each field now owns its own span (they never overwrite one another) and
// that the recital carries the historical incorporation date.
// ---------------------------------------------------------------------------
describeWithCoiSource('CoI original_incorporation_date and effective_date target distinct slots (#608)', () => {
  const fieldSelectorDir = resolveFieldSelectorDir(COI);
  const fieldNames = loadFieldSelectorMetadata(fieldSelectorDir).fields.map((f) => f.name);
  const { manifests } = loadSelectorContracts(fieldSelectorDir, fieldNames);
  const recitalManifest = manifests.find((m) => m.field_id === 'original_incorporation_date')!;
  const executionManifest = manifests.find((m) => m.field_id === 'effective_date')!;

  it('each date field resolves uniquely against the raw source', async () => {
    expect(recitalManifest, 'original_incorporation_date manifest not loaded').toBeDefined();
    expect(executionManifest, 'effective_date manifest not loaded').toBeDefined();

    const raw = await resolveSelectorContracts(cachedSourcePathFor(COI), [recitalManifest, executionManifest]);
    expect(raw.fields[0].unresolved, 'original_incorporation_date unresolved').toBe(false);
    expect(raw.fields[0].assertionFailures).toHaveLength(0);
    expect(raw.fields[1].unresolved, 'effective_date unresolved').toBe(false);
    expect(raw.fields[1].assertionFailures).toHaveLength(0);
  });

  it('the two fields patch different spans without overwriting one another', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-dates-608-'));
    try {
      const cleaned = join(dir, 'cleaned.docx');
      await cleanDocument(cachedSourcePathFor(COI), cleaned, loadCleanConfig(fieldSelectorDir));

      const selector = join(dir, 'selector.docx');
      await applySelectorContracts(cleaned, selector, [recitalManifest, executionManifest]);

      const text = textOf(selector);
      // Exactly one tag each — no cross-contamination.
      expect((text.match(/\{original_incorporation_date\}/g) ?? []).length).toBe(1);
      expect((text.match(/\{effective_date\}/g) ?? []).length).toBe(1);
      // The recital carries the historical incorporation date tag.
      expect(text).toMatch(/originally incorporated pursuant to the General Corporation Law on\s*\{original_incorporation_date\}/);
      // The signature block carries the execution/effective date tag.
      expect(text).toMatch(/executed by a duly authorized officer of this corporation on\s*\{effective_date\}/);
      // The raw source date placeholders are gone from their respective slots.
      expect(text.includes('[________ __, 20__]'), 'recital date placeholder still present').toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renders distinct historical and effective dates end-to-end (recital shows the historical date)', async () => {
    const outputPath = join(mkdtempSync(join(tmpdir(), 'coi-dates-e2e-608-')), 'charter.docx');
    try {
      await runFieldSelector({
        fieldSelectorId: COI,
        outputPath,
        values: {
          company_name: 'Meridian Inc.',
          original_incorporation_date: '1995-03-20',
          effective_date: '2026-07-15',
        },
      });

      const text = textOf(outputPath);
      // Recital identifies the HISTORICAL incorporation date, formatted (not ISO, not shifted a day).
      expect(text).toMatch(/originally incorporated pursuant to the General Corporation Law on\s*March 20, 1995/);
      // Execution/effective date is the OTHER date — the two never overwrite each other.
      expect(text).toMatch(/executed by a duly authorized officer of this corporation on\s*July 15, 2026/);
      // No verbatim ISO leaked into the rendered document.
      expect(text.includes('1995-03-20'), 'raw ISO original_incorporation_date leaked').toBe(false);
      expect(text.includes('2026-07-15'), 'raw ISO effective_date leaked').toBe(false);
    } finally {
      rmSync(outputPath, { recursive: true, force: true });
    }
  });
});
