module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // reanimated:false — nativewind 4.1's css-interop already injects
      // `react-native-reanimated/plugin` itself, so we stop babel-preset-expo
      // from auto-adding it a second time (a double-add can error). We author
      // no worklets ourselves; the single plugin nativewind adds is enough.
      ["babel-preset-expo", { jsxImportSource: "nativewind", reanimated: false }],
      "nativewind/babel",
    ],
  };
};
