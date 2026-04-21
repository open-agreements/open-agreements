import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest's default 5000ms is too tight under --coverage: v8 instrumentation
    // adds ~2x overhead locally and 3-5x on CI runners, which causes tests that
    // comfortably pass at ~500ms to time out on the coverage job. Raise the
    // default to give headroom for coverage + Allure wrapper overhead without
    // hiding genuinely-hung tests. Tests that need more can still pass an
    // explicit timeout as the third arg to it()/test().
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
