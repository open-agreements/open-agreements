import { configDefaults, defineConfig } from 'vitest/config';

// V8 coverage instrumentation adds ~2-3x CPU overhead, which on shared CI
// runners pushes otherwise-fine tests past per-test timeouts. Scale all
// timeouts uniformly when coverage is active, and expose the multiplier via
// `test.env` so test files that hard-code per-test timeouts (which config-
// level `testTimeout` does not override) can opt in via `seconds()` from
// integration-tests/helpers/timeouts.ts.
//
// Non-coverage runs keep the vitest defaults (5s test, 10s hook) so real
// performance regressions still surface immediately in `test (20)` /
// `test (22)` CI jobs.
const isCoverageRun =
  process.argv.includes('--coverage') || process.env.VITEST_COVERAGE === '1';
const timeoutMultiplier = isCoverageRun ? 3 : 1;

export default defineConfig({
  test: {
    testTimeout: 5_000 * timeoutMultiplier,
    hookTimeout: 10_000 * timeoutMultiplier,
    env: {
      VITEST_TIMEOUT_MULTIPLIER: String(timeoutMultiplier),
    },
    setupFiles: ['allure-vitest/setup'],
    exclude: [
      ...configDefaults.exclude,
      '**/.worktrees/**',
      '.claude/worktrees/**',
    ],
    reporters: [
      'default',
      ['allure-vitest/reporter', { resultsDir: './allure-results' }],
    ],
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'src/**/*.ts',
        'packages/contract-templates-mcp/src/**/*.ts',
        'packages/contracts-workspace/src/**/*.ts',
        'packages/contracts-workspace-mcp/src/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/types.ts',
        '**/*.test.ts',
        '**/*.allure.test.ts',
        'src/index.ts',
        'packages/*/src/index.ts',
        'packages/*/src/cli/index.ts',
        '**/__tests__/**',
        '**/dist/**',
        '**/bin/**',
        'content/**',
        'scripts/**',
        'site/**',
        'openspec/**',
        'coverage/**',
        'allure-results/**',
        'allure-report/**',
      ],
    },
  },
});
