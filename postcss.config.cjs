/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const url = require('postcss-url')
const postcssImport = require('postcss-import')
const presetEnv = require('postcss-preset-env')
const cssnano = require('cssnano')
const hoverMedia = require('postcss-hover-media-feature')

const isProd = process.env.NODE_ENV === 'production'

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [postcssImport(), hoverMedia(), url(), presetEnv(), isProd && cssnano({ preset: 'default' })],
}

module.exports = config
