// ESLint 9 - Flat config
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  // 🔕 ignora build e asset
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'out/**',
      'coverage/**',
      'public/**',
      '**/*.d.ts'
    ]
  },

  // Base JS + TS
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Regole per il codice dell'app (browser)
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': a11y,
      import: importPlugin
    },
    rules: {
      // React & Hooks
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import hygiene
      'import/order': ['warn', { 'newlines-between': 'always' }],
      'import/no-unresolved': 'off', // l'alias @/ lo risolve TS

      // A11y base
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',

      // Stile generale
      'no-unused-vars': 'off', // delega a TS rule
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // Regole per script Node locali (setup-*.js, scripts, config)
  {
    files: ['setup-*.js', 'scripts/**/*.{js,ts}', '*.config.{js,cjs,mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
];
