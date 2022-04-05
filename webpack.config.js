const path = require('path');

module.exports = {
 context: __dirname,
  devtool: "eval-source-map",
  entry: {
    base: './src/videocalls.js',
    vr: './src/videocallsvr.js',
    testacs: './src/testacs.js'
  },
  output: {
    path: path.resolve( __dirname, 'src' ),
    filename: 'bundle[name].js'
  }
};