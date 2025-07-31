import { resolve } from 'node:path'

import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import markdown from '@eslint/markdown'
import { globalIgnores } from 'eslint/config'
import eslintConfigLove from 'eslint-config-love'
import importPlugin from 'eslint-plugin-import'
import * as tseslint from 'typescript-eslint'

const TS_JS_FILES = '**/*.{ts,tsx,js,jsx,cjs,mts,mjs}'

export default tseslint.config(
  includeIgnoreFile(resolve('.gitignore')),
  globalIgnores(['!docs/.vitepress', 'docs/.vitepress/cache', '**/auto-imports.d.ts']),
  {
    files: [TS_JS_FILES],
    extends: [eslint.configs.recommended],
  },
  {
    files: [TS_JS_FILES],
    ignores: ['**/*.md/*'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked, eslintConfigLove],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': { typescript: { project: '.' } },
      'import/internal-regex':
        '^(webgl-media-editor|webgl-video-editor|reactive-effects|webgl-effects|shared)/',
      node: {
        typescriptExtensionMap: [
          ['.ts', '.ts'],
          ['.cts', '.cts'],
          ['.mts', '.mts'],
          ['.tsx', '.jsx'],
        ],
      },
    },
    rules: {
      ...importPlugin.flatConfigs.recommended.rules,
      ...importPlugin.flatConfigs.warnings.rules,
      ...importPlugin.flatConfigs.typescript.rules,
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: [-2, -1, 0, 1, 2, 3, 4, 5, 10, 16, 60, 90, 180, 1e3, 1e6, 1e9] },
      ],
      '@typescript-eslint/prefer-destructuring': [
        'error',
        { object: true, array: false },
        { enforceForRenamedProperties: false },
      ],

      '@typescript-eslint/promise-function-async': ['error', { checkArrowFunctions: false }],
      '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowNullableNumber: false,
          allowNullableBoolean: true,
          allowNullableObject: true,
          allowNullableString: true,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowBoolean: true, allowNumber: true },
      ],
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', 'parent', 'index'],
        },
      ],
      'import/no-cycle': 'error',
      'import/no-unresolved': ['error', { ignore: ['^https:', '^virtual:.*css$'] }],
      'import/no-useless-path-segments': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/naming-convention': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-type-assertion': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/init-declarations': 'off',
      'import/default': 'off',
      'n/file-extension-in-import': ['error', 'always'],
      'promise/avoid-new': 'off',
      'promise/param-names': 'off',
      'sort-imports': ['error', { ignoreCase: true, ignoreDeclarationSort: true }],
      'no-console': 'off',
      'no-void': 'off',
      complexity: 'off',
      curly: 'off',
    },
  },
  {
    files: ['packages/**/*.{ts,tsx,js,jsx}'],
    ignores: ['**/*.md/*'],
    rules: {
      'import/no-extraneous-dependencies': 'error',
      'no-console': 'error',
      'import/no-relative-packages': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    ignores: ['**/*.md/*'],
    rules: {
      'import/no-extraneous-dependencies': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },

  {
    files: ['**/*.md'],
    ignores: ['**/CHANGELOG.md'],
    extends: [markdown.configs.processor],
    language: 'markdown/gfm',
  },
  {
    files: ['**/*.md/*'],
    extends: [eslint.configs.recommended, tseslint.configs.stylistic, tseslint.configs.strict],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  },
)
