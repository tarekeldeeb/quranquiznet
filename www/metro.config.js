const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow font, DB, and zip (bundled quran-madina assets for native — see
// src/services/madinaAssets.ts) assets
config.resolver.assetExts.push('woff2', 'woff', 'ttf', 'otf', 'db', 'zip');
config.resolver.sourceExts.push('cjs');

// NB: do NOT enable resolver.unstable_enablePackageExports — it flips other
// packages to their ESM (import.meta) entry, which breaks the classic web bundle.
// The @tarekeldeeb/quran-madina-react wrapper resolves fine via its CJS "main"
// (dist/index.cjs).

module.exports = config;
