import { resolve } from 'node:path'

import alias from '@rollup/plugin-alias'
import replace from '@rollup/plugin-replace'
import esbuild from 'rollup-plugin-esbuild-transform'
import nodeResolve from '@rollup/plugin-node-resolve'
import postcss from 'rollup-plugin-postcss'
import del from 'rollup-plugin-delete'
import terser from '@rollup/plugin-terser'
import url from '@rollup/plugin-url'
import { defineConfig } from 'rollup'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import filesize from 'rollup-plugin-filesize'

const NODE_ENV = process.env.NODE_ENV
const isProd = NODE_ENV === 'production'
const dist = resolve(import.meta.dirname, 'dist')

export default defineConfig({
  plugins: [
    del({ targets: resolve(dist, '*'), runOnce: true }),
    alias({
      entries: {
        '@': resolve(import.meta.dirname, 'src'),
        'virtual:shadow.css': resolve(import.meta.dirname, 'src/index.css'),
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
        'import.meta.env.DEV': JSON.stringify(!isProd),
        'import.meta.env.PROD': JSON.stringify(isProd),
        'import.meta.env.NODE_ENV': JSON.stringify(NODE_ENV),
        'import.meta.env.ASSETS_PATH': '"/assets/"',
        'import.meta.env.VITE_NO_SHADOW_ROOT': 'false',
        'import.meta.env.VITE_DEV_SLOW_DOWN_MS': 'undefined',
      },
      preventAssignment: true,
    }),
    postcss({ inject: false }),
    glslOptimize({ optimize: !isProd, glslify: true }),
    url({
      limit: 0,
      destDir: resolve(dist, 'assets'),
    }),
    isProd && terser(),
    filesize(),
  ],
  input: {
    miru: 'src/index.ts',
    vue2: 'src/vue2/index.ts',
  },
  output: {
    dir: dist,
    format: 'es',
    entryFileNames: '[name].js',
  },
})
