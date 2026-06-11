const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow large JSON assets (q.json is ~7MB)
config.resolver.assetExts.push('db');
config.resolver.sourceExts.push('cjs');

module.exports = config;
