import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Stock Purchase Agreement' });
const FIELD_SELECTOR_ID = 'nvca-stock-purchase-agreement';
const SOURCE = join(homedir(), '.open-agreements', 'cache', FIELD_SELECTOR_ID, 'source.docx');
const SOURCE_SHA256 = 'b2c76452fa82dcda72f1fa9f82ba0ce28ea9445441c897f9cb7ac6663930dcab';
const FIXTURE = JSON.parse(readFileSync(
  join(import.meta.dirname, 'fixtures', 'spa-production-full.json'),
  'utf-8',
)) as Record<string, unknown>;

const describeWithSource = existsSync(SOURCE) ? describe : describe.skip;

function expectCoreTerms(text: string, warnings: string[], series = 'A'): void {
  expect(warnings.filter((warning) => warning.startsWith('verify:'))).toEqual([]);
  expect(text).toContain('Northstar Robotics, Inc.');
  expect(text).toContain('September 15, 2026');
  expect(text).toContain('Agreement, dated as of September 15, 2026');
  expect(text).toContain('August 31, 2026 (the “Balance Sheet Date”)');
  expect(text).toContain('the Balance Sheet Date');
  expect(text).not.toContain('the August 31, 2026');
  expect(text).toContain(`Series ${series} Preferred Stock`);
  expect(text).toContain('$0.0001 par value per share');
  expect(text).toContain('$2.50 per share');
  expect(text).toContain('100,000,000 shares of common stock');
  expect(text).toContain('20,000,000');
  expect(text).toContain('shares of which are issued and outstanding');
  expect(text).toContain('25,000,000 shares of preferred stock');
  expect(text).toContain('10,000,000 shares have been designated');
  expect(text).toMatch(new RegExp(`designated Series\\s+${series} Preferred Stock`));
  expect(text).toContain('12,000,000 shares of Common Stock for issuance');
  expect(text).toContain('$250,000');
  expect(text).toContain('$100,000');
  expect(text).toContain('$500,000 in the aggregate');
  expect(text).toContain('authorized size of the Board of Directors shall be three (3)');
  expect(text).toContain('Alex Rivera, Jordan Lee and Casey Morgan');
  expect(text).not.toMatch(/2026-09-15|2026-08-31/);
  expect(text).not.toMatch(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
  expect(text).not.toContain('$$');
  expect(text).not.toContain('District of District');
  expect(text).not.toContain('state courts of delaware');
  expect(text).toMatch(new RegExp(`Signature Page to Series ${series} Preferred Stock Purchase Agreement`, 'i'));
}

describeWithSource('NVCA SPA production fill', () => {
  it('uses the hash-pinned NVCA source', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe(SOURCE_SHA256);
  });

  it('renders a coherent single-closing courts SPA end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-production-standard-'));
    try {
      const outputPath = join(dir, 'spa-standard.docx');
      const result = await runFieldSelector({ fieldSelectorId: FIELD_SELECTOR_ID, outputPath, values: FIXTURE });
      const text = extractAllText(outputPath);
      expectCoreTerms(text, result.warnings);
      expect(text).toContain('state courts of Delaware');
      expect(text).toContain('U.S. District Court for the District of Delaware');
      expect(text).not.toContain('shall be resolved by arbitration before a single arbitrator');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it('renders additional-closing, convertible-security, and arbitration alternatives', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-production-alternatives-'));
    try {
      const outputPath = join(dir, 'spa-alternatives.docx');
      const result = await runFieldSelector({
        fieldSelectorId: FIELD_SELECTOR_ID,
        outputPath,
        values: {
          ...FIXTURE,
          closing_type: 'additional',
          include_convertible_securities: true,
          include_closing_reference: true,
          dispute_resolution_mode: 'arbitration',
          arbitration_location: 'Wilmington, Delaware',
          series_designation: 'B',
          convertible_series_designation: 'B',
        },
      });
      const text = extractAllText(outputPath);
      expectCoreTerms(text, result.warnings, 'B');
      expect(text).toMatch(/400,000 shares of Series\s+B Preferred Stock/);
      expect(text).toMatch(/Signature Page to Series B Preferred Stock Purchase Agreement/i);
      expect(text).toContain('purchase price of $2.50 per share with respect to the shares of Series B Preferred Stock');
      expect(text).toContain('shall be resolved by arbitration before a single arbitrator');
      expect(text).toContain('Wilmington, Delaware');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
