module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Path alias '@' → './src' is now handled by metro.config.js (resolver.alias).
    // Keeping babel-plugin-module-resolver removed to prevent potential
    // duplicate module instances in Metro's lazy bundle splitting.
  };
};
