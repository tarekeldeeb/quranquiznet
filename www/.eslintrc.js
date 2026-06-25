// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  overrides: [
    {
      // The PWA service worker runs in the ServiceWorkerGlobalScope, not a DOM
      // window — declare its globals (self, caches, Request, URL, fetch, …).
      files: ['public/sw.js'],
      env: { serviceworker: true, browser: true },
    },
    {
      // Test files put jest.mock(...) before imports (jest hoists those mocks
      // above the import statements), which is incompatible with import/first.
      files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
      rules: { 'import/first': 'off' },
    },
  ],
};
