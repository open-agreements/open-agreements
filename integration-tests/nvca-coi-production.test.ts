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
  expect(text).toContain('market capitalization equal to or greater than $250,000,000');
  expect(text).not.toMatch(/at a price of at least \$\[_{3,}\]/);
  expect(text).not.toMatch(/resulting in at least \$\[_{3,}\]/);
  expect(text).not.toMatch(/market capitalization equal to or greater than \$\[_{3,}\]/);
  expect(text).toContain('do not exceed an aggregate of 500,000 shares of Common Stock');
  expect(text).not.toContain('[[do not exceed an aggregate of 500,000');
  expect(text).not.toContain('500,000 shares of Common Stock (including shares underlying (directly or indirectly) any such Options or Convertible Securities)];] [or]');
}

describeWithSource('NVCA COI production fill', () => {
  it('uses the hash-pinned NVCA source', () => {
    const actual = createHash('sha256').update(readFileSync(SOURCE)).digest('hex');
    expect(actual).toBe(SOURCE_SHA256);
  });

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
          include_redemption: true,
          include_redemption_cross_ref: true,
        },
      });
      const text = extractAllText(outputPath);

      expectCleanProductionOutput(text, result.warnings);
      expect(text).toContain('From and after the date of the issuance of any shares of Preferred Stock');
      expect(text).toContain('2.1Preferential Payments');
      expect(text).toContain('Distribution of Remaining Assets');
      expect(text).toContain('4.4.4Adjustment of Conversion Price');
      expect(text).toContain('aggregate of $0.001 of consideration');
      expect(text).toMatch(/Special Mandatory Conversion\.\s+Trigger Event\./);
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
});
