import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Don't lint build output, deps, SQL migrations, or config/build files.
  {
    ignores: [
      'dist',
      'node_modules',
      'supabase',
      '.claude',
      'eslint.config.js',
      'vite.config.ts',
      'postcss.config.js',
      'tailwind.config.js'
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...react.configs.recommended.rules,
      // New JSX transform (Vite/automatic runtime) — React need not be in scope.
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],

      // TypeScript handles these; the core rules false-positive on TS.
      'no-undef': 'off',
      'no-unused-vars': 'off',

      // Project conventions / pragmatic baseline ---------------------------
      // DB row ↔ type mappers in lib/*Api.ts intentionally take `any` rows.
      '@typescript-eslint/no-explicit-any': 'off',
      // Surface unused code as a warning (won't fail the build); allow
      // intentionally-unused identifiers prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      // TS provides prop typing; PropTypes aren't used.
      'react/prop-types': 'off',
      // Apostrophes/quotes in JSX text are valid and intentional throughout
      // the copy; this rule is pure noise here.
      'react/no-unescaped-entities': 'off',
      // Advisory (e.g. ReactDOM.render) — surface, don't fail the build.
      'react/no-deprecated': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },

  // Standalone Node utility scripts (CSV generators) — Node globals, not browser.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
);
