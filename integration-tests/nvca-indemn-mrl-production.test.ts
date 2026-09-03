import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { extractAllText, runFieldSelector } from '../src/core/field-selector/index.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('NVCA Forms').withLabels({ feature: 'Ancillary Agreements' });

const CASES = {
  indemnification: {
    id: 'nvca-indemnification-agreement',
    sha256: 'f9b61b4d99e245573de41d9469925b4332f871ec0e6ac6593055cdfe17825300',
    fixture: 'indemnification-agreement-production-full.json',
  },
  managementRights: {
    id: 'nvca-management-rights-letter',
    sha256: '9661d2a68ca20ee77cf553f1ec5804f08147e7e4c35f5a03938e76a778083e8b',
    fixture: 'management-rights-letter-production-full.json',
  },
} as const;

function sourcePath(id: string): string {
  return join(homedir(), '.open-agreements', 'cache', id, 'source.docx');
}

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf-8')) as Record<string, unknown>;
}

function expectCommonProductionOutput(text: string, warnings: string[]): void {
  expect(warnings.filter((warning) => warning.startsWith('verify:'))).toEqual([]);
  expect(text).not.toMatch(/2026-08-18/);
  expect(text).not.toMatch(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/);
  expect(text).not.toContain('$$');
  expect(text).not.toContain('the the');
}

const describeWithSources = Object.values(CASES).every(({ id }) => existsSync(sourcePath(id)))
  ? describe
  : describe.skip;

describeWithSources('NVCA Indemnification Agreement and Management Rights Letter production fills', () => {
  it('uses the hash-pinned NVCA source documents', () => {
    for (const { id, sha256 } of Object.values(CASES)) {
      const actual = createHash('sha256').update(readFileSync(sourcePath(id))).digest('hex');
      expect(actual).toBe(sha256);
    }
  });

  it('renders a coherent indemnification agreement without confusing the indemnitee and process agent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-indemn-production-'));
    try {
      const outputPath = join(dir, 'indemnification-agreement.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES.indemnification.id,
        outputPath,
        values: loadFixture(CASES.indemnification.fixture),
      });
      const text = extractAllText(outputPath);

      expectCommonProductionOutput(text, result.warnings);
      expect(text).not.toContain('This sample document is the work product');
      expect(text).toContain('as of August 18, 2026 between Northstar Robotics, Inc.');
      expect(text).toContain('and Jordan Lee (\u201cIndemnitee\u201d)');
      expect(text).toContain('irrevocably Capitol Corporate Services, Inc. 1209 Orange Street');
      expect(text).not.toContain('irrevocably Jordan Lee');
      expect(text).not.toContain('[___________], 20[__]');
      expect(text).not.toContain('[name]');
      expect(text).not.toContain('[address]');
      expect(text).toContain('provided by Summit Ventures Fund IV, L.P.');
      expect(text).toContain('terminate on the closing of an initial public offering');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);

  it('renders a coherent Series A management rights letter and complete address line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nvca-mrl-production-'));
    try {
      const outputPath = join(dir, 'management-rights-letter.docx');
      const result = await runFieldSelector({
        fieldSelectorId: CASES.managementRights.id,
        outputPath,
        values: loadFixture(CASES.managementRights.fixture),
      });
      const text = extractAllText(outputPath);

      expectCommonProductionOutput(text, result.warnings);
      expect(text).not.toContain('This sample document is the work product');
      expect(text).not.toContain('Preliminary Notes');
      expect(text).not.toContain('An example of such a letter follows.');
      expect(text).toContain('August 18, 2026');
      expect(text).toContain('Summit Ventures Fund IV, L.P.');
      expect(text).toContain('1000 Innovation Way');
      expect(text).toContain('Reno, Nevada 89501');
      expect(text).toContain('purchase of 2,500,000 shares of Series A Preferred Stock');
      expect(text).toContain('NORTHSTAR ROBOTICS, INC. (the \u201cCompany\u201d)');
      expect(text).not.toContain('[City], [State] [Zip]');
      expect(text).not.toContain('Series [_]');
      expect(text).not.toContain('[_____________________]');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
