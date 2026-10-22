import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', '**/playwright-report', '**/test-results', 'docs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // { a, ...rest } 로 필드를 떼어내는 패턴과 _로 시작하는 이름은 허용
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // 공용 패키지는 React·브라우저에 의존하지 않는다 (CLAUDE.md §4)
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', '@trippocket/web*'],
              message: 'shared는 앱 코드에 의존하지 않아요',
            },
          ],
        },
      ],
    },
  },
  {
    // 화면 그리기 전 실행되는 작은 스크립트 (public/boot.js)
    files: ['apps/web/public/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // 서비스 워커 원본: __PRECACHE__ 는 빌드 때 채워진다 (vite.config.ts)
    files: ['apps/web/src/sw/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, __PRECACHE__: 'readonly' } },
  },
  {
    files: ['**/*.config.{ts,js}', 'eslint.config.js', '**/scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
