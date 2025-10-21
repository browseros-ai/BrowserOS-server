const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      background: './src/background/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              onlyCompileBundledFiles: true,
              compilerOptions: {
                declaration: false,
                declarationMap: false,
              },
            },
          },
          exclude: [/node_modules/, /\.(test|spec)\.(ts|tsx)$/],
        },
      ],
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      new CopyPlugin({
        patterns: [
          {from: 'manifest.json', to: '.'},
          {from: 'assets', to: 'assets'},
        ],
      }),
    ],
    devtool: isProduction ? false : 'source-map',
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
      minimize: isProduction,
      minimizer: isProduction
        ? [
            new TerserPlugin({
              extractComments: false,
              terserOptions: {
                format: {
                  comments: false,
                },
                compress: {
                  // FIXME: nikhil - remove this later after few releases
                  drop_console: false,
                  drop_debugger: true,
                },
              },
            }),
          ]
        : [],
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};
