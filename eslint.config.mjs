// eslint.config.js
const prettierPlugin = require('eslint-plugin-prettier')
const typescriptPlugin = require('@typescript-eslint/eslint-plugin')
const typescriptParser = require('@typescript-eslint/parser')

module.exports = [
  {
    files: ['**/*.{js,ts}'],
    ignores: [
      '.git/**',
      '.idea/**',
      '.vscode/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      'lib/**',
      '**/*.min.js',
      '**/*.spec.js',
      'uploads/**',
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: {
      'prettier': prettierPlugin,
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      'semi': 'true',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'prettier/prettier': 'error',
    },
  },
]
