module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    // react-native-worklets ships the Reanimated 4 babel plugin; it must be last.
    plugins: ["react-native-worklets/plugin"],
  }
}
