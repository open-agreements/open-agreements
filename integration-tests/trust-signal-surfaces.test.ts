import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution').withLabels({ feature: 'Trust Signals' });

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// Static `site/<path>` files are passthrough-copied verbatim into `_site/<path>` at build
// time, so reading from source is equivalent to reading from build output and avoids needing
// the test to depend on a prior `npm run build:site:vercel` invocation in CI.
function readStaticSiteFile(relPath: string): string {
  return readFileSync(join(ROOT, 'site', relPath), 'utf-8');
}

describe('trust signal surfaces', () => {
  it.openspec('OA-DST-006')('README exposes CI and coverage trust signals near the top', () => {
    const readmeTop = readRepoFile('README.md').split('\n').slice(0, 60).join('\n');
    expect(readmeTop).toContain('actions/workflows/ci.yml');
    expect(readmeTop.toLowerCase()).toContain('codecov');
  });

  it.openspec('OA-DST-007')('thin protocol host emits machine-readable trust surfaces while marketing routes redirect externally', () => {
    const serverCard = JSON.parse(readStaticSiteFile('.well-known/mcp-server-card'));
    const apiCatalog = JSON.parse(readStaticSiteFile('.well-known/api-catalog'));
    const agentCard = JSON.parse(readStaticSiteFile('.well-known/agent-card.json'));
    const vercelConfig = JSON.parse(readRepoFile('vercel.json'));
    const redirects = new Map(
      vercelConfig.redirects.map((entry: { source: string; destination: string }) => [entry.source, entry.destination]),
    );

    expect(serverCard.websiteUrl).toBe('https://openagreements.org');
    expect(serverCard.repository.url).toContain('github.com/open-agreements/open-agreements');
    expect(apiCatalog.linkset.map((entry: { anchor: string }) => entry.anchor)).toEqual(
      expect.arrayContaining([
        'https://openagreements.org/api/mcp',
        'https://openagreements.org/api/a2a',
      ]),
    );
    expect(agentCard.url).toMatch(/\/api\/a2a$/);
    expect(agentCard.skills.map((entry: { id: string }) => entry.id)).toEqual(
      expect.arrayContaining(['fill-template', 'list-templates']),
    );
    expect(redirects.get('/')).toBe('https://usejunior.com/developer-tools/open-agreements');
    expect(redirects.get('/trust')).toBe('https://usejunior.com/developer-tools/open-agreements');
    expect(redirects.get('/templates/:name')).toBe('https://usejunior.com/developer-tools/open-agreements/templates/:name');
  });

  it.openspec('OA-DST-006b')('system card stays source-only and never ships as a rendered trust page', () => {
    const systemCard = readRepoFile('site/trust/system-card.md');

    expect(systemCard.startsWith('---\n')).toBe(false);
    expect(systemCard).not.toContain('layout: trust-layout.njk');
    expect(systemCard).toContain('# OpenAgreements System Card');
    expect(existsSync(join(ROOT, '_site', 'trust'))).toBe(false);
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
