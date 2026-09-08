import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect} from 'vitest';
import {itAllure} from './helpers/allure-test.js';
import {extractAllText, runFieldSelector} from '../src/core/field-selector/index.js';

const it = itAllure.epic('Filling & Rendering');
const id = 'nvca-stock-purchase-agreement';
const source = join(homedir(), '.open-agreements/cache', id, 'source.docx');
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/spa-production-full.json'), 'utf8'));
const cases = [false, true].flatMap(sbic => ['single', 'additional'].map(closing => ({sbic, closing})));
const describeWithSource = existsSync(source) ? describe : describe.skip;

describeWithSource('SPA supplied-review SBA companion and Initial Closing regression', () => {
  it('uses the pinned source', () => {
    expect(createHash('sha256').update(readFileSync(source)).digest('hex'))
      .toBe('b2c76452fa82dcda72f1fa9f82ba0ce28ea9445441c897f9cb7ac6663930dcab');
  });
  it.each(cases)('SBIC=$sbic closing=$closing', async ({sbic, closing}) => {
    const dir = mkdtempSync(join(tmpdir(), 'spa-sbic-closing-'));
    try {
      const result = await runFieldSelector({
        fieldSelectorId: id, inputPath: source, outputPath: join(dir, 'filled.docx'),
        values: {...fixture, include_sbic_representation: sbic, closing_type: closing},
        selectionsZeroMatchPolicy: 'error',
      });
      expect(result.warnings).toEqual([]);
      const text = extractAllText(result.outputPath);
      expect(text.includes('Small Business Concern')).toBe(sbic);
      expect(text.includes('SBA Matters')).toBe(sbic);
      expect(text.includes('SBIC Purchaser')).toBe(sbic);
      expect(text.includes('Size Status Declaration on SBA Form 480')).toBe(sbic);
      expect(text.includes('Assurance of Compliance on SBA Form 652')).toBe(sbic);
      expect(text.includes('Portfolio Financing Report on SBA Form 1031')).toBe(sbic);
      expect(text.includes('Initial Closing')).toBe(closing === 'additional');
      expect(/designated as the [“"]Initial Closing[”"]/.test(text)).toBe(closing === 'additional');
      expect(text).toContain('August 31, 2026 (the “Balance Sheet Date”)');
      expect(text).toContain('Conditions to the Purchasers’ Obligations at Closing');
      expect(text).toContain('Conditions of the Company’s Obligations at Closing');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }, 30000);
});
