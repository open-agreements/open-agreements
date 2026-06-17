import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  makeSystemCardMarkdown,
  normalizeScenarioStatus,
  parseMatrixMarkdown,
} from '../scripts/generate_system_card.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const it = itAllure.epic('Platform & Distribution').withLabels({ feature: 'Trust Signals' });

function readRepoFile(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

// A minimal but valid traceability matrix: one covered scenario, one missing,
// and one legacy `pending_impl` row that must normalize to `missing`.
const SAMPLE_MATRIX = [
  '## Capability: `demo`',
  '',
  '| Scenario | Status | Mapped tests |',
  '|---|---|---|',
  '| [OA-DEMO-001] Covered scenario | covered | `integration-tests/demo.test.ts > does a thing#L10` |',
  '| [OA-DEMO-002] Missing scenario | missing |  |',
  '| [OA-DEMO-003] Legacy pending scenario | pending_impl | `integration-tests/demo.test.ts > skipped thing#L20` |',
].join('\n');

function sampleTraceability() {
  return parseMatrixMarkdown(SAMPLE_MATRIX, { bindingEpicByRef: new Map() });
}

const LINK_CONTEXT = {
  allureReportUrl: 'https://tests.openagreements.org',
  useAllureDeepLinks: false,
  allureByRef: new Map(),
};

function freshRuntime() {
  return {
    available: true,
    path: '/tmp/systemCardRuntime.json',
    data: {
      runtime_source: 'allure-summary',
      metrics_available: true,
      generated_at_utc: new Date().toISOString(),
      stats: { total: 250, passed: 248, failed: 2, pass_rate_percent: 99.2 },
      freshness: { age_minutes: 12, is_stale: false },
      run: {
        created_at_utc: new Date().toISOString(),
        commit_sha: 'abc1234',
        commit_url: 'https://github.com/open-agreements/open-agreements/commit/abc1234',
        ci_run_url: 'https://github.com/open-agreements/open-agreements/actions/runs/42',
      },
      report_url: 'https://tests.openagreements.org',
    },
  };
}

describe('repo trust signals', () => {
  it.openspec('OA-DST-006')('README exposes CI and coverage trust signals near the top', () => {
    const readmeTop = readRepoFile('README.md').split('\n').slice(0, 60).join('\n');
    expect(readmeTop).toContain('actions/workflows/ci.yml');
    expect(readmeTop.toLowerCase()).toContain('codecov');
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

  it.openspec('OA-DST-068')(
    'system card surfaces runtime proof metadata and explicit unavailable fallback',
    () => {
      // Runtime data present: commit reference, CI run link, Allure report link,
      // and latest run counts are all shown.
      const withRuntime = makeSystemCardMarkdown({
        traceability: sampleTraceability(),
        runtimeTrust: freshRuntime(),
        linkContext: LINK_CONTEXT,
      });
      expect(withRuntime).toContain(
        '[abc1234](https://github.com/open-agreements/open-agreements/commit/abc1234)',
      );
      expect(withRuntime).toContain(
        '[workflow run](https://github.com/open-agreements/open-agreements/actions/runs/42)',
      );
      expect(withRuntime).toContain('[tests.openagreements.org](https://tests.openagreements.org)');
      expect(withRuntime).toContain('248/250');

      // Runtime data missing: each field is rendered explicitly as Unavailable,
      // not silently omitted, plus a warning naming the missing artifact.
      const withoutRuntime = makeSystemCardMarkdown({
        traceability: sampleTraceability(),
        runtimeTrust: {
          available: false,
          data: null,
          path: '/tmp/systemCardRuntime.json',
          error: 'ENOENT: no such file',
        },
        linkContext: LINK_CONTEXT,
      });
      expect(withoutRuntime).toContain('- Commit: Unavailable');
      expect(withoutRuntime).toContain('- CI run: Unavailable');
      expect(withoutRuntime).toContain('Latest test run');
      expect(withoutRuntime).toContain('runtime trust data is unavailable (ENOENT: no such file)');
    },
  );

  it
    .openspec('OA-DST-069')
    .skip(
      'No automated test yet exercises the system card epic drill-down UI or verifies scenario-level rows and mapped-test expansion behavior.',
      () => {},
    );

  it.openspec('OA-DST-070')(
    'pending-style mappings render as missing and pending_impl is never surfaced',
    () => {
      // The normalizer collapses any legacy non-covered state to `missing`.
      expect(normalizeScenarioStatus('pending_impl')).toBe('missing');
      expect(normalizeScenarioStatus('skipped')).toBe('missing');
      expect(normalizeScenarioStatus('todo')).toBe('missing');

      const traceability = sampleTraceability();
      // The pending_impl row is classified missing in the parsed trust data.
      expect(traceability.missingScenarios.map((s) => s.scenario)).toContain(
        '[OA-DEMO-003] Legacy pending scenario',
      );

      // The rendered trust surface never exposes the legacy `pending_impl` token.
      const card = makeSystemCardMarkdown({
        traceability,
        runtimeTrust: freshRuntime(),
        linkContext: LINK_CONTEXT,
      });
      expect(card).not.toContain('pending_impl');
      expect(card).not.toContain('is-pending');
    },
  );

  it.openspec('OA-DST-071')(
    'a scenario with at least one covered mapped test stays covered',
    () => {
      expect(normalizeScenarioStatus('covered')).toBe('covered');

      const traceability = sampleTraceability();
      expect(traceability.covered).toBeGreaterThanOrEqual(1);
      // The covered scenario is not reported as missing.
      expect(traceability.missingScenarios.map((s) => s.scenario)).not.toContain(
        '[OA-DEMO-001] Covered scenario',
      );

      const card = makeSystemCardMarkdown({
        traceability,
        runtimeTrust: freshRuntime(),
        linkContext: LINK_CONTEXT,
      });
      expect(card).toContain('is-covered');
    },
  );

  describe('runtime artifact freshness gate (OA-DST-072)', () => {
    const RUNTIME_CHECKER = join(ROOT, 'scripts', 'check_system_card_runtime.mjs');
    let tmpDir: string | undefined;

    afterEach(() => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = undefined;
      }
    });

    function writeRuntimeFixture(createdAtUtc: string): string {
      tmpDir = mkdtempSync(join(tmpdir(), 'oa-runtime-'));
      const fixturePath = join(tmpDir, 'systemCardRuntime.json');
      writeFileSync(
        fixturePath,
        JSON.stringify({
          generated_at_utc: createdAtUtc,
          stats: { total: 250, passed: 248, failed: 2, pass_rate_percent: 99.2 },
          run: { created_at_utc: createdAtUtc },
        }),
      );
      return fixturePath;
    }

    function runChecker(args: string[]) {
      return spawnSync('node', [RUNTIME_CHECKER, ...args], { encoding: 'utf-8' });
    }

    it.openspec('OA-DST-072')(
      'runtime artifact must be present, well-shaped, and within the freshness window',
      () => {
        // Present, well-shaped, and fresh -> passes the freshness gate.
        const fresh = writeRuntimeFixture(new Date().toISOString());
        const freshResult = runChecker(['--input', fresh, '--max-age-hours', '24']);
        expect(freshResult.status).toBe(0);

        // Missing artifact -> fails.
        const missingResult = runChecker([
          '--input',
          join(tmpDir!, 'does-not-exist.json'),
          '--max-age-hours',
          '24',
        ]);
        expect(missingResult.status).toBe(1);
        expect(missingResult.stderr).toContain('Missing system card runtime data file');

        // Stale artifact -> fails with a clear staleness message.
        const stale = writeRuntimeFixture('2000-01-01T00:00:00.000Z');
        const staleResult = runChecker(['--input', stale, '--max-age-hours', '24']);
        expect(staleResult.status).toBe(1);
        expect(staleResult.stderr.toLowerCase()).toContain('stale');
      },
    );
  });
});
