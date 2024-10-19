import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import unocss from 'unocss/vite'
import { presetIcons, presetUno } from 'unocss'
import autoImport from 'unplugin-auto-import/vite'
import icons from 'unplugin-icons/vite'

import analyzer from 'vite-bundle-analyzer'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import { autoImportOptions } from './tools/autoImportOptions'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [
    autoImport(autoImportOptions),
    icons({ compiler: 'jsx', jsx: 'preact' }),
    unocss({ presets: [presetUno(), presetIcons()] }),
    glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
    !!process.env.BASIC_SSL && basicSsl(),
    !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
  ],
  resolve: {
    alias: {
      'virtual:shadow.css': resolve(import.meta.dirname, 'src/index.css?inline'),
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@/framework',
    jsxDev: false,
  },
  base: './',
  build: {
    minify: true,
  },
})
