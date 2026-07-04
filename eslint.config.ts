import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import functional from 'eslint-plugin-functional';
import n from 'eslint-plugin-n';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // ── Base configs ──────────────────────────────────────────────
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  prettier,

  // ── Global ignores ────────────────────────────────────────────
  {
    ignores: ['**/dist/', 'node_modules/'],
  },

  // ── Type-checked linting ──────────────────────────────────────
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── All TypeScript files ──────────────────────────────────────
  // Boundaries enforcement (eslint-plugin-boundaries) lands at
  // BUILD_PLAN chunk 0.3, once the real package graph is settled.
  {
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    plugins: {
      functional,
      sonarjs,
      unicorn,
      n,
    },
    rules: {
      // ── TypeScript ──────────────────────────────────────────
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // ── Complexity limits ───────────────────────────────────
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['error', 3],
      'max-depth': ['error', 3],

      // ── Functional rules ────────────────────────────────────
      'functional/no-let': 'error',
      'functional/immutable-data': [
        'error',
        {
          ignoreImmediateMutation: true,
          ignoreClasses: true,
        },
      ],
      'functional/prefer-readonly-type': ['warn', { allowLocalMutation: true }],
      'functional/no-loop-statements': 'warn',

      // ── Array callback safety ─────────────────────────────
      'unicorn/no-array-callback-reference': 'error',

      // ── Portability ───────────────────────────────────────
      'n/no-path-concat': 'error',
    },
  },

  // ── Test file overrides ───────────────────────────────────────
  {
    files: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      '**/test/**/*.ts',
    ],
    rules: {
      'functional/immutable-data': 'off',
      'functional/no-let': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      // Vitest matchers (expect.objectContaining, expect.any) return `any`.
      // Mocks are inherently loosely typed — relax the full no-unsafe family.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // Mock stubs commonly use `async () => value` to satisfy async
      // interfaces without needing an actual await expression.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
