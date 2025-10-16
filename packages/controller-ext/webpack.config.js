const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      background: './src/background/index.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      new Dotenv({
        path: './.env',
        safe: false,
        systemvars: true,
        silent: true,
        defaults: './.env.example'
      })
    ],
    devtool: isProduction ? false : 'source-map',
    optimization: {
      minimize: isProduction,
      usedExports: true
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    }
  };
};
