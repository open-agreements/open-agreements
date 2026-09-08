import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Certificate of Incorporation' });

const FIELD_SELECTOR_ID = 'nvca-certificate-of-incorporation';
const SOURCE = join(homedir(), '.open-agreements', 'cache', FIELD_SELECTOR_ID, 'source.docx');
const SOURCE_SHA256 = 'd75600769c12724990de48149d7a2bb161f3522daa54b1783672f93697d87d29';
const FIXTURE = JSON.parse(readFileSync(
  join(import.meta.dirname, 'fixtures', 'coi-production-full.json'),
  'utf-8',
)) as Record<string, unknown>;

const describeWithSource = existsSync(SOURCE) ? describe : describe.skip;

// Exact canonical enabled regression choices from LE #2518; these are test
// inputs, not defaults or inferred negotiated transaction economics.
const REDEMPTION_CHOICES = {
  include_redemption: true,
  include_redemption_cross_ref: true,
  redemption_price_basis: 'greater_of_original_issue_price_and_fair_market_value',
  include_redemption_holder_opt_out: true,
  redemption_start_date: '2030-05-21',
  redemption_interest_rate: '10',
  redemption_compounding_frequency: 'annually',
};
const CONDITIONAL_REDEMPTION_FIELDS = [
  'redemption_start_date', 'redemption_interest_rate', 'redemption_compounding_frequency',
  'redemption_price_basis', 'include_redemption_holder_opt_out',
];

function expectCleanProductionOutput(text: string, warnings: string[]): void {
  expect(warnings.filter((warning) => warning.startsWith('verify:'))).toEqual([]);
  expect(text).toContain('Northstar Robotics, Inc.');
  expect(text).toContain('April 12, 2021');
  expect(text).toContain('September 15, 2026');
  expect(text).not.toMatch(/2021-04-12|2026-09-15|2031-09-15/);
  expect(text).not.toMatch(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
  // The NVCA source retains optional bracketed drafting alternatives; the
  // pipeline verifier above is the authoritative check that no *mapped*
  // placeholder survives.  Do not confuse intentionally unmapped source
  // brackets with a failed field substitution.
  expect(text).not.toContain('$$');
  expect(text).not.toMatch(/20\d{2}20\d{2}/);
  expect(text).not.toContain('Northstar Systems, Inc..');
  expect(text).toContain('holders of at least 60% of');
  expect(text).not.toContain('60%%');
  expect(text).toContain('Conversion Price” applicable to the Preferred Stock as of the Original Issue Date shall be equal to $2.50 per share');
  expect(text).toContain('at a price of at least $10.00 per share');
  expect(text).toContain('resulting in at least $50,000,000');
  // This fixture selects the IPO branch, so the alternative direct-listing
  // market-cap clause (and its supplied inactive value) must not leak.
  expect(text).not.toContain('$250,000,000');
  expect(text).not.toMatch(/at a price of at least \$\[_{3,}\]/);
  expect(text).not.toMatch(/resulting in at least \$\[_{3,}\]/);
  expect(text).not.toMatch(/market capitalization equal to or greater than \$\[_{3,}\]/);
  // This fixture omits the optional strategic-partnership exception, so its
  // supplied inactive cap must not leak into the selected charter text.
  expect(text).not.toContain('500,000 shares of Common Stock');
  expect(text).not.toContain('[[do not exceed an aggregate of 500,000');
  expect(text).not.toContain('500,000 shares of Common Stock (including shares underlying (directly or indirectly) any such Options or Convertible Securities)];] [or]');
}

describeWithSource('NVCA COI production fill', () => {
  it('uses the hash-pinned NVCA source', () => {
    const actual = createHash('sha256').update(readFileSync(SOURCE)).digest('hex');
    expect(actual).toBe(SOURCE_SHA256);
  });

  for (const field of CONDITIONAL_REDEMPTION_FIELDS) {
    it(`refuses enabled redemption without ${field} before emitting output`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'coi-redemption-incomplete-'));
      try {
        const values: Record<string, unknown> = {...FIXTURE, ...REDEMPTION_CHOICES};
        delete values[field];
        const outputPath = join(dir, 'incomplete.docx');
        await expect(runFieldSelector({fieldSelectorId: FIELD_SELECTOR_ID, inputPath: SOURCE, outputPath, values}))
          .rejects.toThrow(`Incomplete conditional input: ${field}`);
        expect(existsSync(outputPath)).toBe(false);
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });
  }

  it('allows disabled redemption with all conditional economics and choices omitted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-redemption-disabled-'));
    try {
      const values: Record<string, unknown> = {...FIXTURE, include_redemption: false};
      for (const field of CONDITIONAL_REDEMPTION_FIELDS) delete values[field];
      const result = await runFieldSelector({fieldSelectorId: FIELD_SELECTOR_ID, inputPath: SOURCE, outputPath: join(dir, 'disabled.docx'), values, selectionsZeroMatchPolicy: 'error'});
      expect(result.warnings).toEqual([]);
      const text = extractAllText(result.outputPath);
      expect(text).not.toContain('General. Unless prohibited');
      expect(text).toContain('Preferred Stock is not redeemable');
      expect(text).toContain('Redeemed or Otherwise Acquired Shares.');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }, 15_000);

  it('rejects misspelled negotiated-term selections', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-production-invalid-selection-'));
    try {
      await expect(runFieldSelector({
        fieldSelectorId: FIELD_SELECTOR_ID,
        outputPath: join(dir, 'invalid.docx'),
        values: { ...FIXTURE, anti_dilution_type: 'full-ratchet' },
      })).rejects.toThrow('Enum field "anti_dilution_type" received unknown option "full-ratchet"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renders a coherent non-participating Series A charter end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-production-standard-'));
    try {
      const outputPath = join(dir, 'coi-standard.docx');
      const result = await runFieldSelector({
        fieldSelectorId: FIELD_SELECTOR_ID,
        outputPath,
        values: FIXTURE,
      });
      const text = extractAllText(outputPath);

      expectCleanProductionOutput(text, result.warnings);
      expect(text).toContain('determined in accordance with the following formula');
      expect(text).toContain('such amount per share as would have been payable had all shares');
      expect(text).not.toContain('4.4.4Adjustment of Conversion Price');
      expect(text).not.toContain('Distribution of Remaining Assets');
      expect(text).not.toContain('Special Mandatory Conversion.,');
      expect(text).not.toMatch(/Special Mandatory Conversion\s*\.\s*,/);
      expect(text).not.toContain('General. Unless prohibited by Delaware law');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('uses a non-A series designation consistently in every operative reference', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-production-series-b-'));
    try {
      const outputPath = join(dir, 'coi-series-b.docx');
      const result = await runFieldSelector({
        fieldSelectorId: FIELD_SELECTOR_ID,
        outputPath,
        values: { ...FIXTURE, series_designation: 'B' },
      });
      const text = extractAllText(outputPath);

      expectCleanProductionOutput(text, result.warnings);
      expect(text).toContain('designated as “Series B Preferred Stock”');
      expect(text).toContain('References to “Preferred Stock” mean the Series B Preferred Stock');
      expect(text).toContain('with respect to the Series B Preferred Stock, $2.50 per share');
      expect(text).toContain('$2.50 per share of Series B Preferred Stock');
      expect(text).toContain('first share of Series B Preferred Stock is issued');
      expect(text).not.toContain('Series A Preferred Stock');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('renders cumulative, participating, full-ratchet, pay-to-play and redemption selections', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'coi-production-alternatives-'));
    try {
      const outputPath = join(dir, 'coi-alternatives.docx');
      const result = await runFieldSelector({
        fieldSelectorId: FIELD_SELECTOR_ID,
        outputPath,
        values: {
          ...FIXTURE,
          dividend_type: 'cumulative',
          liquidation_participation: 'participating',
          anti_dilution_type: 'full_ratchet',
          include_pay_to_play: true,
          ...REDEMPTION_CHOICES,
        },
      });
      const text = extractAllText(outputPath);

      expectCleanProductionOutput(text, result.warnings);
      expect(text).toContain('From and after the date of the issuance of any shares of Preferred Stock');
      expect(text).toContain('2.1Preferential Payments');
      expect(text).toContain('Distribution of Remaining Assets');
      expect(text).toContain('4.4.4Adjustment of Conversion Price');
      // The selected modern pay-to-play branch no longer carries the older
      // optional nominal-consideration alternative.
      expect(text).not.toContain('aggregate of $0.001 of consideration');
      expect(text).toContain('Special Mandatory Conversion');
      expect(text).toContain('Trigger Events');
      expect(text).not.toContain('Special Mandatory Conversion.,');
      expect(text).not.toMatch(/Special Mandatory Conversion\s*\.\s*,/);
      expect(text).toContain('General. Unless prohibited by Delaware law');
      expect(text).toContain('and prior to September 15, 2028');
      expect(text).not.toContain('[Date]');
      expect(text).toContain('$20,000,000 in gross proceeds');
      expect(text).toContain('excluding proceeds previously received');
      expect(text).not.toContain('[including/excluding]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  for (const price of ['greater_of_original_issue_price_and_fair_market_value', 'original_issue_price_plus_declared_unpaid_dividends']) {
    for (const optOut of [false, true]) {
      it(`closes selected redemption alternatives: price=${price}, optOut=${optOut}`, async () => {
        const dir = mkdtempSync(join(tmpdir(), 'coi-redemption-choices-'));
        try {
          const result = await runFieldSelector({
            fieldSelectorId: FIELD_SELECTOR_ID,
            inputPath: SOURCE,
            outputPath: join(dir, 'selected.docx'),
            selectionsZeroMatchPolicy: 'error',
            values: {...FIXTURE, ...REDEMPTION_CHOICES, redemption_price_basis: price, include_redemption_holder_opt_out: optOut},
          });
          expect(result.warnings).toEqual([]);
          const text = extractAllText(result.outputPath);
          const start = text.indexOf('General. Unless prohibited');
          const end = text.indexOf('Redeemed or Otherwise Acquired Shares.');
          expect(start).toBeGreaterThan(-1);
          expect(end).toBeGreaterThan(start);
          const redemption = text.slice(start, end);
          expect(redemption).not.toMatch(/[\[\]]/);
          expect(redemption).toContain('10%');
          expect(redemption).toContain('compounded annually');
          expect(redemption).toContain('May 21, 2030');
          const fmv = price === 'greater_of_original_issue_price_and_fair_market_value';
          expect(redemption.includes('third-party appraiser')).toBe(fmv);
          expect(redemption.includes('greater of (A)')).toBe(fmv);
          expect(redemption.includes('20th day after')).toBe(optOut);
          expect(redemption.includes('shall thereafter be “Excluded Shares.”')).toBe(optOut);
        } finally {
          rmSync(dir, {recursive: true, force: true});
        }
      }, 15_000);
    }
  }
});
