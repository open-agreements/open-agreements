import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {describe, expect} from 'vitest';
import {itAllure} from './helpers/allure-test.js';
import {extractAllText, runFieldSelector} from '../src/core/field-selector/index.js';

const it = itAllure.epic('Filling & Rendering');
const id = 'nvca-investors-rights-agreement';
const source = join(homedir(), '.open-agreements/cache', id, 'source.docx');
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/ira-production-full.json'), 'utf8'));
const cases = [false, true].flatMap(fcpa => [false, true].flatMap(cyber => [false, true].map(written => ({fcpa, cyber, written}))));
const describeWithSource = existsSync(source) ? describe : describe.skip;

describeWithSource('IRA independent covenant lifecycle (LE #2519)', () => {
  it('uses the pinned real NVCA source', () => {
    expect(createHash('sha256').update(readFileSync(source)).digest('hex'))
      .toBe('be8ad13f171a343bdb53716b1d318689ae3477cdf7f1986b2e3985e1cabbd08a');
  });

  it.each(cases)('FCPA=$fcpa cybersecurity=$cyber writtenPolicies=$written', async ({fcpa, cyber, written}) => {
    const dir = mkdtempSync(join(tmpdir(), 'ira-covenant-lifecycle-'));
    try {
      const outputPath = join(dir, 'filled.docx');
      const result = await runFieldSelector({
        fieldSelectorId: id, inputPath: source, outputPath, selectionsZeroMatchPolicy: 'error',
        values: {
          ...fixture, include_fair_practices_covenant: fcpa, include_cybersecurity_covenant: cyber,
          include_fcpa_written_policies: written, include_real_property_reporting: true,
          include_corporate_governance_program: true,
          // Deliberately selected Annex policies must not be confused with the
          // same words in independently selected operative covenant headings.
          annex_2_policies: [
            {policy: 'FCPA policy', deadline: '180 days post-Closing'},
            {policy: 'Cybersecurity policy', deadline: '180 days post-Closing'},
          ],
        },
      });
      const text = extractAllText(outputPath);
      expect(result.warnings).toEqual([]);
      expect(text.includes('The Company covenants that it shall not')).toBe(fcpa);
      expect(text.includes('FCPA\n')).toBe(fcpa);
      expect(text.includes('The Company shall, within 180 days')).toBe(cyber);
      expect(text.includes('Cybersecurity\n')).toBe(cyber);
      expect(text.includes('and written policies')).toBe(fcpa && written);
      expect(text).toContain('interest in the Company constitutes a United States real property interest');
      expect(text).toContain('prepare and submit each of the corporate governance policies');
      expect(text).toContain('FCPA policy');
      expect(text).toContain('Cybersecurity policy');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }, 30000);
});
