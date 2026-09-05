import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { loadFieldSelectorMetadata } from '../src/core/metadata.js';
import { resolveFieldSelectorDir } from '../src/utils/paths.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Investor and Governance Agreements' });

const SELECTOR_ID = 'nvca-rofr-co-sale-agreement';
const SOURCE_SHA256 = '126b4a402d41b768ff0c9aebf593792159c31ca7a930c440dd5ae0516ef4c4ad';
const SOURCE_PATH = join(homedir(), '.open-agreements', 'cache', SELECTOR_ID, 'source.docx');
const FIXTURE_PATH = join(import.meta.dirname, 'fixtures', 'rofr-co-sale-agreement-production-full.json');
const REPLACEMENTS_PATH = join(
  import.meta.dirname,
  '..',
  'templates',
  'nvca-free-non-redistributable',
  SELECTOR_ID,
  'replacements.json',
);

const describeWithSource = existsSync(SOURCE_PATH) ? describe : describe.skip;

describeWithSource('NVCA ROFR/Co-Sale drafting-choice and company-specific blank coverage', () => {
  it('uses the pinned source and covers every broad placeholder shape with contextual keys', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex')).toBe(SOURCE_SHA256);

    const sourceText = extractAllText(SOURCE_PATH);
    const broadPatterns = [...new Set(sourceText.match(/\[[_A-Z][_A-Z\s]+\]/g) ?? [])];
    const replacementKeys = Object.keys(
      JSON.parse(readFileSync(REPLACEMENTS_PATH, 'utf8')) as Record<string, string>,
    );

    expect(broadPatterns).not.toEqual([]);
    expect(broadPatterns.filter((pattern) => !replacementKeys.some((key) => key.includes(pattern)))).toEqual([]);
    expect([...new Set(sourceText.match(/\[_{3,}\]/g) ?? [])].filter(
      (pattern) => !replacementKeys.some((key) => key.includes(pattern)),
    )).toEqual([]);
  });

  it('fills the company-specific share, percentage, and competitor carriers end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-choice-coverage-'));
    try {
      const outputPath = join(dir, 'rofr-co-sale-agreement.docx');
      const values = {
        ...(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>),
        include_investor_status_minimum: true,
        include_ten_percent_sale_exempt_transfer: true,
        include_key_holder_consent_minimum: true,
      };
      const result = await runFieldSelector({ fieldSelectorId: SELECTOR_ID, outputPath, values });
      const text = extractAllText(outputPath);

      expect(result.warnings.filter((warning) => /zero match|verify:/i.test(warning))).toEqual([]);
      expect(text).toContain('Additionally, in no event shall Northstar Ventures III, L.P. or its Affiliates be a Competitor hereunder.');
      expect(text).toContain('collectively hold fewer than 250,000 shares of Capital Stock');
      expect(text).toContain('sale by the Key Holder of up to 10% of the Transfer Stock');
      expect(text).toContain('representing at least 5% of the outstanding Capital Stock');
      expect(text).toContain('holds at least 100,000 shares of Capital Stock');
      expect(text).not.toMatch(/\[(?:____|__________|____________)\]/);
      expect(text).not.toContain('10%%');
      expect(text).not.toContain('5%%');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('omits the complete competitor carveout when the negotiated choice is none', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-no-competitor-carveout-'));
    try {
      const outputPath = join(dir, 'rofr-co-sale-agreement.docx');
      const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
      const result = await runFieldSelector({
        fieldSelectorId: SELECTOR_ID,
        outputPath,
        values: { ...fixture, competitor_exclusion_mode: 'none', excluded_competitor_name: '' },
      });
      const text = extractAllText(outputPath);

      expect(result.warnings.filter((warning) => /zero match|verify:/i.test(warning))).toEqual([]);
      expect(text).not.toContain('Northstar Ventures III, L.P. or its Affiliates be a Competitor');
      expect(text).not.toMatch(/in no event shall\s+or its Affiliates/);
      expect(text).not.toContain('in no event shall [____]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('omits the competitor carveout when named mode has an empty name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-empty-named-competitor-'));
    try {
      const outputPath = join(dir, 'rofr-co-sale-agreement.docx');
      const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
      const result = await runFieldSelector({
        fieldSelectorId: SELECTOR_ID,
        outputPath,
        values: { ...fixture, competitor_exclusion_mode: 'named', excluded_competitor_name: '' },
      });
      const text = extractAllText(outputPath);

      expect(result.warnings.filter((warning) => /zero match/i.test(warning))).toEqual([]);
      expect(text).not.toMatch(/in no event shall\s+or its Affiliates/);
      expect(text).not.toContain('in no event shall [____]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('publishes accurate Investor fall-away semantics and keeps optional proviso inputs non-required', () => {
    const metadata = loadFieldSelectorMetadata(resolveFieldSelectorDir(SELECTOR_ID));
    const fields = new Map(metadata.fields.map((field) => [field.name, field]));

    expect(fields.has('key_holder_minimum_shares')).toBe(false);
    expect(fields.get('investor_minimum_shares')?.description).toContain('retain Investor status');
    expect(fields.get('competitor_exclusion_mode')).toMatchObject({
      type: 'enum',
      default: 'none',
      options: ['none', 'named'],
    });
    expect(fields.get('excluded_competitor_name')?.default).toBe('');
    expect(metadata.priority_fields ?? []).not.toContain('excluded_competitor_name');
    for (const fieldName of [
      'investor_minimum_shares',
      'permitted_transfer_percentage',
      'key_holder_consent_threshold_percentage',
      'permitted_transferee_minimum_shares',
    ]) {
      expect(fields.get(fieldName)?.default).toBeUndefined();
      expect(metadata.priority_fields ?? []).not.toContain(fieldName);
    }
  });

  it('preserves visible insertion markers when optional proviso values are omitted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-visible-optional-blanks-'));
    try {
      const outputPath = join(dir, 'rofr-co-sale-agreement.docx');
      const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
      for (const fieldName of [
        'investor_minimum_shares',
        'permitted_transfer_percentage',
        'key_holder_consent_threshold_percentage',
        'permitted_transferee_minimum_shares',
      ]) delete fixture[fieldName];
      fixture.include_investor_status_minimum = true;
      fixture.include_ten_percent_sale_exempt_transfer = true;
      fixture.include_key_holder_consent_minimum = true;

      await runFieldSelector({ fieldSelectorId: SELECTOR_ID, outputPath, values: fixture });
      const text = extractAllText(outputPath);

      expect(text).toContain('collectively hold fewer than [INSERT INVESTOR MINIMUM SHARES] shares of Capital Stock');
      expect(text).toContain('sale by the Key Holder of up to [INSERT PERMITTED TRANSFER PERCENTAGE]% of the Transfer Stock');
      expect(text).toContain('representing at least [INSERT KEY HOLDER CONSENT THRESHOLD PERCENTAGE]% of the outstanding Capital Stock');
      expect(text).toContain('holds at least [INSERT PERMITTED TRANSFEREE MINIMUM SHARES] shares of Capital Stock');
      expect(text).not.toContain('collectively hold fewer than  shares');
      expect(text).not.toContain('up to % of the Transfer Stock');
      expect(text).not.toContain('holds at least  shares');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('rejects an unsupported competitor-exclusion mode', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-invalid-competitor-mode-'));
    try {
      const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
      await expect(runFieldSelector({
        fieldSelectorId: SELECTOR_ID,
        outputPath: join(dir, 'rofr-co-sale-agreement.docx'),
        values: { ...fixture, competitor_exclusion_mode: 'sometimes' },
      })).rejects.toThrow(/competitor_exclusion_mode.*sometimes/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
