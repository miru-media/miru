import { resolve } from 'node:path'

import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import url from '@rollup/plugin-url'
import { defineConfig } from 'rollup'
import del from 'rollup-plugin-delete'
import esbuild from 'rollup-plugin-esbuild-transform'
import filesize from 'rollup-plugin-filesize'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import postcss from 'rollup-plugin-postcss'
import autoImport from 'unplugin-auto-import/rollup'
import icons from 'unplugin-icons/rollup'

import { autoImportOptions } from './tools/autoImportOptions.js'

const ROOT = resolve(import.meta.dirname)
const NODE_ENV = process.env.NODE_ENV
const isProd = NODE_ENV === 'production'

/**
 * @typedef {{
 *  root: string,
 *  inputs: Record<string, string>
 *  external: string[]
 *  dist?: string
 *  clearDist?: boolean
 * }} Options
 **/

/** @type {Options[]} */
const packageOptions = [
  {
    root: 'packages/media-editor',
    inputs: {
      'media-editor': 'index.ts',
      vue2: 'vue2/index.ts',
    },
    external: [],
  },
  {
    root: 'packages/media-trimmer',
    inputs: {
      'media-trimmer': 'index.ts',
      elements: 'elements/index.ts',
      vue2: 'vue2.ts',
    },
    external: ['mp4box', 'mp4-muxer'],
  },
]

const aliases = {
  entries: {
    '@': resolve(ROOT, 'packages/shared'),
    'virtual:image-shadow.css': resolve(ROOT, 'packages/media-editor/index.css'),
    'virtual:video-shadow.css': resolve(ROOT, 'packages/video-editor/index.css'),
  },
}

console.log(aliases)

/** @type {import('rollup-plugin-esbuild-transform').Options[]} */
const esbuildOptions = [
  {
    include: /\.(t|j)s$/,
    loader: 'ts',
  },
  {
    include: /\.(t|j)sx$/,
    loader: 'tsx',
    jsx: 'automatic',
    jsxImportSource: '@/framework',
    jsxDev: false,
  },
]

const replacements = {
  values: {
    'import.meta.hot': 'undefined',
    'import.meta.env.DEV': JSON.stringify(!isProd),
    'import.meta.env.PROD': JSON.stringify(isProd),
    'import.meta.env.NODE_ENV': JSON.stringify(NODE_ENV),
    'import.meta.env.ASSETS_PATH': '"/assets/"',
    'import.meta.env.VITE_DEV_SLOW_DOWN_MS': 'undefined',
  },
  preventAssignment: true,
}

export default packageOptions.map(({ root: inputRoot, inputs, external, dist, clearDist = true }) => {
  dist = dist ? resolve(inputRoot, dist) : resolve(inputRoot, 'dist')

  return defineConfig({
    plugins: [
      clearDist && del({ targets: resolve(dist, '*'), runOnce: true }),
      nodeResolve({ extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'] }),
      commonjs(),
      alias(aliases),
      esbuild(esbuildOptions),
      replace(replacements),
      postcss({ inject: false }),
      autoImport(autoImportOptions),
      icons({ compiler: 'jsx', jsx: 'preact', defaultClass: 'icon' }),
      glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
      url({ limit: 0, destDir: resolve(dist, 'assets') }),
      isProd && terser(),
      filesize(),
    ],
    input: Object.fromEntries(
      Object.entries(inputs).map(([key, filename]) => [key, resolve(inputRoot, filename)]),
    ),
    external,
    output: {
      dir: dist,
      format: 'es',
      entryFileNames: '[name].js',
      sourcemap: true,
    },
  })
})
