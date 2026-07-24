module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transform TypeScript (including `declare` fields) and
      // allow JSX in TS files and treat other extensions as needed
      ['@babel/plugin-transform-typescript', { allowDeclareFields: true, isTSX: true, allExtensions: true }],

      'react-native-worklets/plugin',
    ],
  };
};