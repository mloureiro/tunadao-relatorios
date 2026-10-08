import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const devOnlyImports = {
  group: ['exceljs', 'jszip', '**/scripts/**', '**/fixtures/**'],
  message:
    'The workbook writer and fixtures are dev-only and must not reach the page bundle.',
};

const coreRestrictedProperty =
  'MemberExpression[property.name=/^(toLocaleString|localeCompare|parseFloat)$/]';

export default defineConfig(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'vendor/',
      'public/',
      'examples/',
      'fixtures/generated/',
      'wiki/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [devOnlyImports],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: globals.es2023 },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            devOnlyImports,
            {
              group: ['node:*'],
              message: 'src/core is pure: no Node built-ins.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core must not touch the DOM.' },
        { name: 'document', message: 'src/core must not touch the DOM.' },
        {
          name: 'Intl',
          message: 'Format through src/core/format, not Intl.',
        },
        {
          name: 'parseFloat',
          message: 'Use the pt-PT number parser in src/core.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: coreRestrictedProperty,
          message:
            'toLocaleString, localeCompare and parseFloat are locale- or environment-dependent; use the src/core helpers.',
        },
      ],
    },
  },
);
