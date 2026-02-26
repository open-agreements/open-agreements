import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['allure-vitest/setup'],
    exclude: [
      ...configDefaults.exclude,
      '**/.worktrees/**',
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
