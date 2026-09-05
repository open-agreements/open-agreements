import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Investor and Governance Agreements' });

const sourceAvailable = existsSync(join(
  homedir(),
  '.open-agreements',
  'cache',
  'nvca-voting-agreement',
  'source.docx',
));
const describeWithSource = sourceAvailable ? describe : describe.skip;

async function renderVotingAgreement(overrides: Record<string, unknown> = {}): Promise<{
  text: string;
  warnings: string[];
}> {
  const dir = mkdtempSync(join(tmpdir(), 'nvca-voting-board-fields-'));
  try {
    const fixture = JSON.parse(readFileSync(
      join(import.meta.dirname, 'fixtures', 'voting-agreement-board-production.json'),
      'utf-8',
    )) as Record<string, unknown>;
    const outputPath = join(dir, 'voting-agreement.docx');
    const result = await runFieldSelector({
      fieldSelectorId: 'nvca-voting-agreement',
      outputPath,
      values: { ...fixture, ...overrides },
    });
    return { text: extractAllText(outputPath), warnings: result.warnings };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describeWithSource('NVCA Voting Agreement board fields', () => {
  it('selects and fills the minimum-share preferred-director alternative', async () => {
    const { text, warnings } = await renderVotingAgreement();

    expect(warnings).toEqual([]);
    expect(text).toContain('at least 1,250,000 shares of Preferred Stock');
    expect(text).not.toContain('of the outstanding capital stock of the Company on an as-converted basis');
    expect(text).toContain('which individual as of the date of this Agreement is Elena Torres');
    expect(text).not.toContain('[______] shares of Preferred Stock');
    expect(text).not.toContain('is [_____________]');
  }, 15_000);

  it('selects and fills the number-only percentage alternative with correct spacing', async () => {
    const { text, warnings } = await renderVotingAgreement({
      preferred_director_eligibility_basis: 'minimum_percentage',
      preferred_director_minimum_shares: '',
      preferred_director_minimum_percentage: '5',
    });

    expect(warnings).toEqual([]);
    expect(text).toContain('at least 5% of the outstanding capital stock');
    expect(text).not.toContain('shares of Preferred Stock, which number is subject to appropriate adjustment');
    expect(text).toContain('which individual as of the date of this Agreement is Elena Torres');
    expect(text).not.toContain('isElena Torres');
    expect(text).not.toContain('[_____]% of the outstanding capital stock');
    expect(text).not.toContain('is[___________]');
  }, 15_000);

  it('keeps a visible insertion marker when the selected share threshold is empty', async () => {
    const { text, warnings } = await renderVotingAgreement({
      preferred_director_eligibility_basis: 'minimum_shares',
      preferred_director_minimum_shares: '',
    });

    expect(warnings).toEqual([]);
    expect(text).toContain('at least [INSERT MINIMUM SHARE COUNT] shares of Preferred Stock');
    expect(text).not.toContain('at least  shares of Preferred Stock');
    expect(text).not.toContain('of the outstanding capital stock of the Company on an as-converted basis');
  }, 15_000);

  it('keeps a visible insertion marker when the selected percentage threshold is empty', async () => {
    const { text, warnings } = await renderVotingAgreement({
      preferred_director_eligibility_basis: 'minimum_percentage',
      preferred_director_minimum_shares: '',
      preferred_director_minimum_percentage: '',
    });

    expect(warnings).toEqual([]);
    expect(text).toContain('at least [INSERT MINIMUM OWNERSHIP PERCENTAGE]% of the outstanding capital stock');
    expect(text).not.toContain('at least % of the outstanding capital stock');
    expect(text).not.toContain('shares of Preferred Stock, which number is subject to appropriate adjustment');
  }, 15_000);

  it('fills the distinct common, named-common, CEO, and mutual director occurrences', async () => {
    const { text, warnings } = await renderVotingAgreement();

    expect(warnings).toEqual([]);
    expect(text).toContain('which individual as of the date of this Agreement is Priya Shah');
    expect(text).toContain('CEO Director”), who as of the date of this Agreement is Maya Imani');
    expect(text).toContain('Mutual Director”), which individual as of the date of this Agreement is Jordan Lee');
    expect(text).not.toContain('[name of a Common Director]');
    expect(text).not.toContain('CEO Director”), who as of the date of this Agreement is [_____]');
  }, 15_000);
});
