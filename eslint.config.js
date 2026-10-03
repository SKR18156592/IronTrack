import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/sw.js'],
    languageOptions: { globals: globals.serviceworker }
  },
  {
    files: ['tests/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    rules: {
      // `catch (e) {}` is used deliberately for best-effort calls (storage, audio, JSON parsing).
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  }
];
