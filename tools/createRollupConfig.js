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

import { autoImportOptions } from './autoImportOptions.js'

const NODE_ENV = process.env.NODE_ENV
const isProd = NODE_ENV === 'production'

export const createRollupConfig = (
  /**
   * @type {{
   *  root: string,
   *  inputs: Record<string, string>
   *  external: string[]
   *  dist?: string
   *  clearDist?: boolean
   * }}
   **/
  { root: inputRoot, inputs, external, dist, clearDist = true },
) => {
  dist = dist ? resolve(inputRoot, dist) : resolve(inputRoot, 'dist')
  const root = resolve(import.meta.dirname, '..')

  return defineConfig({
    plugins: [
      clearDist && del({ targets: resolve(dist, '*'), runOnce: true }),
      commonjs(),
      alias({
        entries: {
          '@': resolve(root, 'packages/shared'),
          'virtual:image-shadow.css': resolve(root, 'packages/image-editor/index.css'),
          'virtual:video-shadow.css': resolve(root, 'packages/video-editor/index.css'),
        },
      }),
      nodeResolve(),
      esbuild([
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
      ]),
      replace({
        values: {
          'import.meta.hot': 'undefined',
          'import.meta.env.DEV': JSON.stringify(!isProd),
          'import.meta.env.PROD': JSON.stringify(isProd),
          'import.meta.env.NODE_ENV': JSON.stringify(NODE_ENV),
          'import.meta.env.ASSETS_PATH': '"/assets/"',
          'import.meta.env.VITE_DEV_SLOW_DOWN_MS': 'undefined',
        },
        preventAssignment: true,
      }),
      postcss({ inject: false }),
      autoImport(autoImportOptions),
      icons({ compiler: 'jsx', jsx: 'preact', defaultClass: 'icon' }),
      glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
      url({
        limit: 0,
        destDir: resolve(dist, 'assets'),
      }),
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
}
