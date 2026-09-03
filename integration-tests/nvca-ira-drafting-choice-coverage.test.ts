import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Investor and Governance Agreements' });

const ID = 'nvca-investors-rights-agreement';
const SOURCE = join(homedir(), '.open-agreements', 'cache', ID, 'source.docx');
const FIXTURE = JSON.parse(readFileSync(
  join(import.meta.dirname, 'fixtures', 'ira-drafting-choices-full.json'),
  'utf-8',
)) as Record<string, unknown>;

const describeWithSource = existsSync(SOURCE) ? describe : describe.skip;

async function fill(values: Record<string, unknown>, allowVerifyWarnings = false): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'nvca-ira-drafting-choices-'));
  const outputPath = join(dir, 'investors-rights-agreement.docx');
  try {
    const result = await runFieldSelector({ fieldSelectorId: ID, outputPath, values });
    if (!allowVerifyWarnings) {
      expect(result.warnings.filter((warning) => warning.startsWith('verify:'))).toEqual([]);
    }
    return extractAllText(outputPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describeWithSource('NVCA IRA drafting-choice coverage', () => {
  it('fills the Major Investor and board-observer thresholds with contextual bindings', async () => {
    const text = await fill(FIXTURE);

    expect(text).toContain('holds at least 250,000 shares of Registrable Securities');
    expect(text).toContain('As long as Atlas Peak Ventures, L.P. owns not less than 100,000 shares of Preferred Stock');
    expect(text).not.toMatch(/holds at least \[______\] shares of Registrable Securities/);
    expect(text).not.toMatch(/As long as \[_____\] owns not less than \[____\] shares of Preferred Stock/);
  });

  it('renders a named Competitor exclusion as a complete negotiated clause', async () => {
    const text = await fill(FIXTURE);

    expect(text).toContain('Additionally, in no event shall Example Strategic Holdings LLC or its Affiliates be a Competitor hereunder.');
    expect(text).not.toContain('in no event shall [____]');
  });

  it('omits the optional Competitor exclusion without leaving a broken clause', async () => {
    const text = await fill({
      ...FIXTURE,
      competitor_exclusion_mode: 'none',
      excluded_competitor_name: '',
    });

    expect(text).not.toContain('Example Strategic Holdings LLC');
    expect(text).not.toMatch(/in no event shall\s+or its Affiliates/);
    expect(text).not.toContain('in no event shall [____]');
  });

  it('safely omits named Competitor mode when the name is empty', async () => {
    const text = await fill({
      ...FIXTURE,
      competitor_exclusion_mode: 'named',
      excluded_competitor_name: '',
    });

    expect(text).not.toMatch(/in no event shall\s+or its Affiliates/);
    expect(text).not.toContain('in no event shall [____]');
  });

  it('ignores an unused Competitor name when exclusion mode is none', async () => {
    const text = await fill({
      ...FIXTURE,
      competitor_exclusion_mode: 'none',
      excluded_competitor_name: 'Unused Holdings LLC',
    });

    expect(text).not.toContain('Unused Holdings LLC');
    expect(text).not.toMatch(/in no event shall\s+or its Affiliates/);
  });

  it('fills the distinct Section 6.1 transferee minimum-share threshold', async () => {
    const text = await fill(FIXTURE);

    expect(text).toContain('after such transfer, holds at least 75,000 shares of Registrable Securities');
    expect(text).not.toContain('[holds at least [_____] shares of Registrable Securities');
    expect(text).not.toContain('75,000[together with its Affiliates');
  });

  it('selects the alternative Major Investor eligibility standard without glued text', async () => {
    const text = await fill({ ...FIXTURE, transferee_eligibility_standard: 'major_investor' });

    expect(text).toContain('after such transfer, together with its Affiliates, would be a Major Investor; provided, however');
    expect(text).not.toContain('[holds at least [_____] shares of Registrable Securities');
    expect(text).not.toContain('Major Investor][together');
  });

  it('keeps a visible drafting placeholder when minimum-shares mode lacks a threshold', async () => {
    const text = await fill({
      ...FIXTURE,
      transferee_eligibility_standard: 'minimum_shares',
      transferee_minimum_shares: '',
    }, true);

    expect(text).toContain('holds at least [INSERT TRANSFEREE MINIMUM SHARES] shares of Registrable Securities');
    expect(text).not.toMatch(/holds at least\s+shares of Registrable Securities/);
  });
});
