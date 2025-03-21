import eslint from '@eslint/js'
import markdown from '@eslint/markdown'
import importPlugin from 'eslint-plugin-import'
import * as tseslint from 'typescript-eslint'

const TS_JS_FILES = '**/*.{ts,tsx,js,jsx,cjs,mts,mjs}'
const DOCS_IGNORES = ['!docs/.vitepress', '**/dist/**', 'docs/.vitepress/cache/**']

export default tseslint.config(
  markdown.configs.recommended,
  // https://github.com/eslint/markdown/issues/276
  // markdown.configs.processor,
  { files: ['**/*.md'], language: 'markdown/gfm' },
  {
    files: [TS_JS_FILES],
    ignores: [...DOCS_IGNORES],
    extends: [tseslint.configs.base],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.md/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.md/*.*'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [TS_JS_FILES],
    ignores: DOCS_IGNORES,
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.warnings,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      'import/resolver': { typescript: { project: '.' } },
      'import/internal-regex':
        '^(webgl-media-editor|miru-video-editor|reactive-effects|webgl-effects|shared)/',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: true,
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'all', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-namespace': 'off',
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
      'import/no-relative-packages': 'error',
      'import/no-useless-path-segments': 'error',
      'no-undef': 'off',
      'sort-imports': ['error', { ignoreCase: true, ignoreDeclarationSort: true }],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'import/no-extraneous-dependencies': 'error',
      'no-console': 'error',
    },
  },
)
