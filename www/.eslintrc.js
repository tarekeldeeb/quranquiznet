// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // /dist/* is the build output; public/quran-madina is a vendored, pinned
  // third-party build (synced via scripts/sync-madina-assets.mjs) — not ours to lint.
  ignorePatterns: ['/dist/*', '/public/quran-madina/*'],
  overrides: [
    {
      // require() is Metro's asset-loading mechanism — fonts/images/sounds/json
      // can't be ESM-imported without type shims, so allow it for bundled asset
      // files. Scoped to TS/TSX: plain-Node .js scripts (metro.config, config
      // plugins, …) are CommonJS, where require() is simply correct.
      files: ['**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-require-imports': ['warn', {
          allow: ['\\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?|mp3|wav|json)$'],
        }],
      },
    },
    {
      // The PWA service worker runs in the ServiceWorkerGlobalScope, not a DOM
      // window — declare its globals (self, caches, Request, URL, fetch, …).
      files: ['public/sw.js'],
      env: { serviceworker: true, browser: true },
    },
    {
      // Test files put jest.mock(...) before imports (jest hoists those mocks
      // above the import statements), which is incompatible with import/first.
      // require() inside tests is likewise the standard way to load a module
      // after its mocks are registered.
      files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
      rules: {
        'import/first': 'off',
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      // Dynamic Expo config + Jest setup run under plain Node/CommonJS
      // (require, __dirname, process) rather than the app's browser/RN env.
      files: ['app.config.js', 'jest.setup.js'],
      env: { node: true, jest: true },
    },
  ],
};
