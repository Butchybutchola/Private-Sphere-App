module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    jest: true,
  },
  globals: {
    __DEV__: 'readonly',
    fetch: 'readonly',
    FormData: 'readonly',
    Blob: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly',
    btoa: 'readonly',
    atob: 'readonly',
    require: 'readonly',
  },
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'babel.config.js', 'jest.config.js'],
};
