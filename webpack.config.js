
module.exports = {
  mode: 'development',
  entry: __dirname + '/source/bundleIndex.js',

  output: {
    path: __dirname + '/source/resource/webpack-bundle',
    filename: 'bundle.js'
  },

 resolve: {
    modules: [
      "node_modules",
      __dirname,
    ],
  },

  module : {
    rules:[
      {
        test: /\.css$/,
        use: [ "style-loader", "css-loader"]
      }

    ]
  }
};
