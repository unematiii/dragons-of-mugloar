import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.vue'],
  })),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    plugins: { import: importPlugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@mugloar/**', group: 'internal', position: 'after' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          distinctGroup: false,
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['return', 'throw'] },
        { blankLine: 'always', prev: ['if', 'switch', 'for', 'while', 'try'], next: '*' },
        { blankLine: 'always', prev: ['function', 'class'], next: ['function', 'class'] },
        { blankLine: 'always', prev: 'block-like', next: 'block-like' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'vue/no-v-html': 'error',
      'vue/no-mutating-props': 'error',
      'vue/require-v-for-key': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/game/test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: false,
        project: './packages/game/tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/api/test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: false,
        project: './apps/api/tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/web/test/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: false,
        project: './apps/web/tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/api/**/*.ts', 'apps/cli/**/*.ts', 'packages/db/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['apps/web/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mugloar/api',
              message: 'Browser code may depend on shared contracts and game rules only.',
            },
            { name: '@mugloar/db', message: 'Database code must stay on the server.' },
          ],
          patterns: ['../../api/**', '../../db/**'],
        },
      ],
    },
  },
  {
    files: ['packages/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@mugloar/api' }, { name: '@mugloar/db' }], patterns: ['../../apps/**'] },
      ],
    },
  },
  {
    files: ['packages/game/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@mugloar/api' },
            { name: '@mugloar/db' },
            { name: 'fastify' },
            { name: 'drizzle-orm' },
            { name: 'pg' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*/controller.js', '../*/routes.js', '../*/schemas.js', '../*/types.js'],
              message: 'Import another API module through its index.ts.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
