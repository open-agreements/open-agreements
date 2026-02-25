import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const it = itAllure.epic('Platform & Distribution').withLabels({ feature: 'Trust Signals' });

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('trust signal surfaces', () => {
  it.openspec('OA-DST-006')('README exposes CI, coverage, and test framework trust signals near the top', () => {
    const readmeTop = readRepoFile('README.md').split('\n').slice(0, 60).join('\n');
    expect(readmeTop).toContain('actions/workflows/ci.yml');
    expect(readmeTop.toLowerCase()).toContain('codecov');
    expect(readmeTop).toContain('Tests: Vitest');
  });

  it.openspec('OA-DST-007')('landing page trust section links npm, CI, coverage, and test framework signal', () => {
    const indexTemplate = readRepoFile('site/index.njk');
    expect(indexTemplate).toContain('npmjs.org/package/open-agreements');
    expect(indexTemplate).toContain('actions/workflows/ci.yml/badge.svg');
    expect(indexTemplate).toContain('app.codecov.io/gh/open-agreements/open-agreements');
    expect(indexTemplate).toContain('Vitest-based test runs');
  });

  it.openspec('OA-DST-008')('CI workflow uploads lcov coverage to Codecov', () => {
    const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
    expect(ciWorkflow).toContain('Upload coverage to Codecov');
    expect(ciWorkflow).toContain('codecov/codecov-action@v5');
    expect(ciWorkflow).toContain('files: ./coverage/lcov.info');
  });

  it.openspec('OA-DST-009')('CI workflow uploads machine-readable JUnit test results', () => {
    const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
    expect(ciWorkflow).toContain('Test coverage + JUnit results');
    expect(ciWorkflow).toContain('Upload test results to Codecov');
    expect(ciWorkflow).toContain('codecov/test-results-action@v1');
    expect(ciWorkflow).toContain('files: ./coverage/junit.xml');
  });

  it.openspec('OA-DST-010')('Codecov uploads are OIDC/tokenless-first', () => {
    const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
    expect(ciWorkflow).toContain('use_oidc: true');
    expect(ciWorkflow).toContain('Tokenless/OIDC-first upload.');
    expect(ciWorkflow).toContain('CODECOV_TOKEN as a repository secret');
    expect(ciWorkflow).not.toContain('token: ${{ secrets.CODECOV_TOKEN }}');
  });

  it.openspec(['OA-DST-011', 'OA-DST-012'])('repository coverage gate policy is codified with ratchet guidance', () => {
    const codecovConfig = readRepoFile('.github/codecov.yml');
    expect(codecovConfig).toContain('project:');
    expect(codecovConfig).toContain('target: auto');
    expect(codecovConfig).toContain('threshold: 0.5%');
    expect(codecovConfig).toContain('patch:');
    expect(codecovConfig).toContain('target: 85%');
    expect(codecovConfig).toContain('threshold: 5%');
    expect(codecovConfig).toContain('Ratchet plan');
  });

  it.openspec('OA-DST-013')('coverage denominator targets implementation sources and excludes support paths', () => {
    const vitestConfig = readRepoFile('vitest.config.ts');
    expect(vitestConfig).toContain("'src/**/*.ts'");
    expect(vitestConfig).toContain("'packages/contracts-workspace/src/**/*.ts'");
    expect(vitestConfig).toContain("'packages/contracts-workspace-mcp/src/**/*.ts'");
    expect(vitestConfig).toContain("'**/*.test.ts'");
    expect(vitestConfig).toContain("'scripts/**'");
    expect(vitestConfig).toContain("'site/**'");
  });
});
