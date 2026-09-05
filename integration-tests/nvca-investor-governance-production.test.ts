import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Investor and Governance Agreements' });

const CASES = [
  {
    id: 'nvca-investors-rights-agreement',
    sha256: 'be8ad13f171a343bdb53716b1d318689ae3477cdf7f1986b2e3985e1cabbd08a',
    fixture: 'ira-production-full.json',
  },
  {
    id: 'nvca-voting-agreement',
    sha256: '3496d7ae9343d1b5b7db13239313c6512e7e0d68d13273538c4dbf06416a5f0d',
    fixture: 'voting-agreement-production-full.json',
  },
  {
    id: 'nvca-rofr-co-sale-agreement',
    sha256: '126b4a402d41b768ff0c9aebf593792159c31ca7a930c440dd5ae0516ef4c4ad',
    fixture: 'rofr-co-sale-agreement-series-c.json',
  },
] as const;

const sourcesAvailable = CASES.every(({ id }) => existsSync(
  join(homedir(), '.open-agreements', 'cache', id, 'source.docx'),
));
const describeWithSources = sourcesAvailable ? describe : describe.skip;

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf-8')) as Record<string, unknown>;
}

function expectVerifiedFill(text: string, warnings: string[]): void {
  expect(warnings.filter((warning) => warning.startsWith('verify:'))).toEqual([]);
  expect(text).not.toMatch(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
  expect(text).not.toMatch(/2026-09-15/);
  expect(text).not.toContain('60%%');
  expect(text).not.toContain('Northstar Robotics[Board of Directors]');
}

describeWithSources('NVCA investor and governance production fills', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} uses its hash-pinned source`, () => {
      const source = join(homedir(), '.open-agreements', 'cache', testCase.id, 'source.docx');
      expect(createHash('sha256').update(readFileSync(source)).digest('hex')).toBe(testCase.sha256);
    });
  }

  it('renders a coherent Investors Rights Agreement end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-ira-production-'));
    try {
      const outputPath = join(dir, 'investors-rights-agreement.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES[0].id,
        outputPath,
        values: loadFixture(CASES[0].fixture),
      });
      const text = extractAllText(outputPath);

      expectVerifiedFill(text, result.warnings);
      expect(text).toContain('made as of September 15, 2026');
      expect(text).toContain('Northstar Robotics, Inc., a Delaware corporation');
      expect(text).toContain('robotics software and autonomous warehouse systems');
      expect(text).toContain('Series A Preferred Stock');
      expect(text).toContain('par value $0.0001 per share');
      expect(text).toContain('selected by the Company and shall be reasonably acceptable');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('selects the Board alternative without leaving the adjacent Company alternative', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-ira-board-selection-'));
    try {
      const outputPath = join(dir, 'investors-rights-agreement.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES[0].id,
        outputPath,
        values: { ...loadFixture(CASES[0].fixture), underwriter_selection: 'board_of_directors' },
      });
      const text = extractAllText(outputPath);

      expectVerifiedFill(text, result.warnings);
      expect(text).toContain('selected by the Board of Directors and shall be reasonably acceptable');
      expect(text).not.toContain('Company[Board of Directors]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('renders a coherent Voting Agreement end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-voting-production-'));
    try {
      const outputPath = join(dir, 'voting-agreement.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES[1].id,
        outputPath,
        values: loadFixture(CASES[1].fixture),
      });
      const text = extractAllText(outputPath);

      expectVerifiedFill(text, result.warnings);
      expect(text).toContain('as of September 15, 2026');
      expect(text).toContain('Northstar Robotics, Inc., a Delaware corporation');
      expect(text).toContain('Atlas Peak Ventures, L.P.');
      expect(text).toContain('Harbor Seed Fund II, L.P.');
      expect(text).toContain('KEY HOLDERS: Maya Imani');
      expect(text).toContain('holders of at least 60%');
      expect(text).toContain('Series A Preferred Stock');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('renders a coherent ROFR and Co-Sale Agreement end to end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-rofr-production-'));
    try {
      const outputPath = join(dir, 'rofr-co-sale-agreement.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES[2].id,
        outputPath,
        values: loadFixture(CASES[2].fixture),
      });
      const text = extractAllText(outputPath);

      expectVerifiedFill(text, result.warnings);
      expect(text).toContain('IMIM Technologies, Inc., a Delaware corporation');
      expect(text).toContain('AI-native contract lifecycle automation');
      expect(text).toContain('(ii) 45 days after delivery');
      expect(text).toContain('holders of at least 60%');
      expect(text).toContain('Series C Preferred Stock');
      expect(text).toContain('par value $0.0001 per share');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
