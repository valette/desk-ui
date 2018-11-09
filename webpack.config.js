var path = require('path');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, 'source/bundleIndex.js'),
  optimization : {
    namedModules : true
  },

  devtool : false,

  output: {
    path: path.resolve(__dirname, 'source/script'),
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
