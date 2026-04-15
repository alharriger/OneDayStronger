const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve the '@' path alias to './src' at the Metro level.
// This ensures Metro and Babel both agree on module resolution,
// preventing potential duplicate-module issues in lazy bundle splitting.
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;
