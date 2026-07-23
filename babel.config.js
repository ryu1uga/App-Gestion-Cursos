module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated debe ir de último en la lista de plugins
    plugins: ['react-native-reanimated/plugin'],
  }
}
