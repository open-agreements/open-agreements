import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { resolveRecipeDir } from '../src/utils/paths.js';
import { loadCleanConfig } from '../src/core/metadata.js';
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

  it('loads the real nvca company_name manifest + template manifest', () => {
    const recipeDir = resolveRecipeDir('nvca-stock-purchase-agreement');
    const { manifests, templateManifest } = loadSelectorContracts(recipeDir, ['company_name']);
    expect(manifests.map((m) => m.field_id)).toEqual(['company_name']);
    expect(templateManifest?.migrated_keys).toEqual([
      '[Insert Company Name]',
      '[Company name]',
      '[____________]',
    ]);
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
