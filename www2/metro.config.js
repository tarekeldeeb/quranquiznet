const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow font and DB assets
config.resolver.assetExts.push('woff2', 'woff', 'ttf', 'otf', 'db');
config.resolver.sourceExts.push('cjs');

module.exports = config;
