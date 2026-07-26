import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  {
    // Playground files are formatting fixtures for seps itself
    ignores: ['test/playground/', 'lib/', 'node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Turns off stylistic rules that would conflict with Prettier
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The only places allowed to touch console: the logger, since wrapping it
    // is the whole point of the class, and the build/tooling scripts, which
    // print straight to the terminal by design.
    files: ['src/common/utils/logger.ts', 'scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },
];
