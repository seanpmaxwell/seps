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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
];
