/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const unoCss = require('unocss/postcss')
const url = require('postcss-url')
const postcssImport = require('postcss-import')
const presetEnv = require('postcss-preset-env')
const cssnano = require('cssnano')
const hoverMedia = require('postcss-hover-media-feature')

const isProd = process.env.NODE_ENV === 'production'
const noShadowRoot = process.env.VITE_NO_SHADOW_ROOT

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: [
    postcssImport(),
    noShadowRoot && {
      postcssPlugin: 'miru :host selector',
      Rule(rule) {
        rule.selector = rule.selector.replace(
          /:host(\(.*\))?/,
          (_match, params) => `miru-image-editor${params ? `:is${params}` : ''}`,
        )
      },
    },
    unoCss({ configOrPath: 'uno.postcss.config.ts' }),
    hoverMedia(),
    url(),
    isProd && presetEnv(),
    isProd && cssnano({ preset: 'default' }),
  ],
}

module.exports = config
