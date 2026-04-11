import tseslint from 'typescript-eslint'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

export default tseslint.config(
  // TypeScript strict type-checked rules for .ts files
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Svelte files
  ...sveltePlugin.configs['flat/recommended'],

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  // Svelte-specific parser config
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  // Project-wide rule overrides
  {
    rules: {
      // Enforce explicit return types on public-facing functions
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',
      // No explicit any
      '@typescript-eslint/no-explicit-any': 'error',
      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      // No unused vars (use _ prefix to suppress)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Require awaiting promises
      '@typescript-eslint/await-thenable': 'error',
      // No non-null assertions — use proper narrowing
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },

  // Ignore build output and node_modules
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
)
