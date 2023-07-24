const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  // TODO: support extensions && default index.xx
  //   resolve: {
  //     extensions: ['.ts', '.tsx'],
  //   },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env'], ['@babel/preset-react'], ['@babel/preset-typescript']],
          },
        },
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
  ],

  devtool: 'source-map',
  devServer: {
    compress: false,
    port: 4000,
    open: true,
    client: {
      logging: 'none',
    },
  },
};
