
module.exports = {
  mode: 'development',
  entry: __dirname + '/source/bundleIndex.js',

  output: {
    path: __dirname + '/source/script',
    filename: 'bundle.js'
  },

  node: {
    fs: 'empty'
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
