import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.tgz'],
  },

  // Base JS recommendations.
  js.configs.recommended,

  // TypeScript recommendations (non-type-aware by default).
  ...tseslint.configs.recommended,

  // Project runtime: Node.js (ESM).
  {
    files: ['**/*.{js,cjs,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Common pattern in this repo: prefix unused params with "_" to document intent.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
];
