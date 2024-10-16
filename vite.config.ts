import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import unocss from 'unocss/vite'
import { presetIcons, presetUno } from 'unocss'

import analyzer from 'vite-bundle-analyzer'
import glslOptimize from 'rollup-plugin-glsl-optimize'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [
    unocss({ presets: [presetUno(), presetIcons()] }),
    glslOptimize({ optimize: true, compress: isProd, glslify: true }),
    !!process.env.BASIC_SSL && basicSsl(),
    !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
  ],
  resolve: {
    alias: {
      'virtual:shadow.css': resolve(__dirname, 'src/index.css?inline'),
      '@': resolve(__dirname, 'src'),
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
