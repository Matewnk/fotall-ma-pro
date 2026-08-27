module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Requis par react-native-reanimated (utilisé par
    // @react-navigation/drawer, 021) : doit toujours etre le dernier
    // plugin de la liste.
    plugins: ['react-native-reanimated/plugin'],
  };
};
