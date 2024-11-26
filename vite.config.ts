import { resolve } from 'node:path'

import basicSsl from '@vitejs/plugin-basic-ssl'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import { presetIcons, presetUno } from 'unocss'
import unocss from 'unocss/vite'
import autoImport from 'unplugin-auto-import/vite'
import icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import analyzer from 'vite-bundle-analyzer'
import remoteAssets from 'vite-plugin-remote-assets'

import { autoImportOptions } from './tools/autoImportOptions'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [
    autoImport(autoImportOptions),
    remoteAssets({
      awaitDownload: true,
      rules: [
        {
          match: /\b(https?:\/\/[\w#&?./-]*?\.(?:webm|mp4))(?=[`'")\]])/gi,
        },
      ],
    }),
    icons({ compiler: 'jsx', jsx: 'preact', defaultClass: 'icon' }),
    unocss({
      presets: [presetUno(), presetIcons()],
      content: {
        pipeline: {
          include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/],
          exclude: ['dist', 'packages/*/dist'],
        },
      },
    }),
    glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
    !!process.env.BASIC_SSL && basicSsl(),
    !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
  ],
  resolve: {
    alias: {
      'virtual:image-shadow.css': resolve(import.meta.dirname, 'packages/media-editor/index.css?inline'),
      'virtual:video-shadow.css': resolve(import.meta.dirname, 'packages/video-editor/index.css?inline'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'shared/framework',
  },
  base: './',
  build: {
    minify: false,

    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        imageeditor: resolve(import.meta.dirname, 'image/index.html'),
        etro: resolve(import.meta.dirname, 'etro.html'),
        videoeditor: resolve(import.meta.dirname, 'video/index.html'),
        videotrimmer: resolve(import.meta.dirname, 'trim/index.html'),
      },
    },
  },
})
