module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(!isTest);

  if (isTest) {
    // In Jest, use the same preset the original config used.
    // The Reanimated plugin is intentionally excluded — the module is mocked
    // via moduleNameMapper, and the plugin requires react-native-worklets/plugin
    // at transform time which cannot run in the Jest environment.
    return {
      presets: [require.resolve('expo/internal/babel-preset')],
    };
  }

  // Metro (app bundler) — full config with Reanimated plugin last
  return {
    presets: [require.resolve('expo/internal/babel-preset')],
    plugins: [require.resolve('react-native-reanimated/plugin')],
  };
};
