// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // /dist/* is the build output; public/quran-madina is a vendored, pinned
  // third-party build (synced via scripts/sync-madina-assets.mjs) — not ours to lint.
  ignorePatterns: ['/dist/*', '/public/quran-madina/*'],
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
    {
      // Dynamic Expo config + Jest setup run under plain Node/CommonJS
      // (require, __dirname, process) rather than the app's browser/RN env.
      files: ['app.config.js', 'jest.setup.js'],
      env: { node: true, jest: true },
    },
  ],
};
