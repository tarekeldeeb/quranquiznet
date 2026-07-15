const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow font, DB, and zip (bundled quran-madina assets for native — see
// src/services/madinaAssets.ts) assets
config.resolver.assetExts.push('woff2', 'woff', 'ttf', 'otf', 'db', 'zip');
config.resolver.sourceExts.push('cjs');

// Expo SDK 53 flips this to true by default, which causes a Firebase JS SDK
// "dual package hazard": Metro resolves @firebase/app through two different
// export conditions in different parts of the dependency graph, so the app
// registers itself in one copy's component registry while `firebase/auth`
// registers `auth` in the other — crashing at launch with "Component auth has
// not been registered yet" (see facebook/metro + firebase/firebase-js-sdk#8988,
// expo/expo#36588). Force it back off; sourceExts already has 'cjs' above, which
// is what lets Metro resolve Firebase's classic (non-exports) entries instead,
// and that's also what keeps @tarekeldeeb/quran-madina-react on its CJS build
// (avoiding its ESM import.meta entry, which breaks the web bundle).
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
