import { resolve } from 'node:path'

import alias from '@rollup/plugin-alias'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import url from '@rollup/plugin-url'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import del from 'rollup-plugin-delete'
import esbuild from 'rollup-plugin-esbuild-transform'
import filesize from 'rollup-plugin-filesize'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import postcss from 'rollup-plugin-postcss'
import autoImport from 'unplugin-auto-import/rollup'
import icons from 'unplugin-icons/rollup'

import rootPkg from './package.json' with { type: 'json' }
import { autoImportOptions } from './scripts/auto-import-options.js'
import { globImportFrag } from './scripts/glob-import-frag.js'
import { packageOptions } from './scripts/package-build-options.cjs'
import { getPublickPackageDirs, ROOT } from './scripts/utils.js'

const { NODE_ENV } = process.env
const isProd = NODE_ENV === 'production'
const PUBLIC_PACKAGE_DIRS = getPublickPackageDirs()
const PATCHED_DEPS = Object.keys(rootPkg.pnpm.patchedDependencies)

const opusWasmFile = resolve(
  ROOT,
  'node_modules/.pnpm/@libav.js+variant-opus@6.5.7/node_modules/@libav.js/variant-opus/dist/libav-6.7.7.1.1-opus.wasm.wasm',
)

const aliases = {
  entries: {
    [`${opusWasmFile}?url`]: opusWasmFile,
  },
}

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
    jsxImportSource: 'fine-jsx',
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
    'import.meta.env.VITE_SHOW_ENV_MATCHER_DEBUG': 'undefined',
  },
  preventAssignment: true,
}

export default (await packageOptions).map((options) => {
  const {
    root: inputRoot,
    inputs,
    clearDist = true,
    alwaysBundle = [],
    external = (id) => {
      if (
        [...alwaysBundle, ...PATCHED_DEPS].some((dep) => id === dep || id.includes(`/node_modules/${dep}/`))
      )
        return false

      if (id.includes('/node_modules/')) return true

      const resolvedPath = resolve(ROOT, id)
      if (resolvedPath.startsWith(resolve(ROOT, inputRoot))) return false

      if (PUBLIC_PACKAGE_DIRS.some((dir) => resolvedPath.startsWith(dir))) return true
    },
  } = options

  const dist = options.dist ? resolve(inputRoot, options.dist) : resolve(inputRoot, 'dist')

  return defineConfig({
    plugins: [
      clearDist && del({ targets: resolve(dist, '*'), runOnce: true }),
      nodeResolve({ extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'] }),
      globImportFrag(),
      commonjs(),
      alias(aliases),
      esbuild(esbuildOptions),
      replace(replacements),
      postcss({ inject: true }),
      autoImport(autoImportOptions),
      icons({ compiler: 'jsx', jsx: 'preact', defaultClass: 'icon' }),
      glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
      url({
        include: ['**/*.svg', '**/*.png', '**/*.jp(e)?g', '**/*.gif', '**/*.webp', '**/*.wasm'],
        limit: 0,
        destDir: resolve(dist, 'assets'),
      }),
      isProd && terser(),
      filesize(),
      options.copy && copy(options.copy({ ...options, dist, clearDist, external, alwaysBundle })),
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
      hoistTransitiveImports: false,
    },
  })
})
