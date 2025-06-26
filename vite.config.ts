/// <reference types="vitest/config" />

import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import NodeGlobalsPolyfill from '@esbuild-plugins/node-globals-polyfill'
import basicSsl from '@vitejs/plugin-basic-ssl'
import globImport from 'rollup-plugin-glob-import'
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

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [
    autoImport(autoImportOptions),
    remoteAssets({
      awaitDownload: true,
      rules: [
        {
          match: /\b(https?:\/\/[\w#&?./-]*?\.(?:webm|mp4|mp3|task))(?=[`'")\]])/gi,
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
    globImport({ format: 'default' }),
    glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
    !!process.env.BASIC_SSL && basicSsl(),
    !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
  ],
  resolve: {
    alias: {
      ebml: require.resolve('ebml/lib/ebml.umd.js'),
      'virtual:image-shadow.css': resolve(
        import.meta.dirname,
        'packages/webgl-media-editor/index.css?inline',
      ),
      'virtual:video-shadow.css': resolve(
        import.meta.dirname,
        'packages/webgl-video-editor/src/index.css?inline',
      ),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'fine-jsx',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        (NodeGlobalsPolyfill as unknown as { default: (...args: unknown[]) => any }).default({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  build: {
    minify: false,
    sourcemap: true,
  },
  assetsInclude: new RegExp(
    `\\.(` +
      [
        // Tesnsor flow task file
        'task',
        // HDR textures
        'hdr',
        // glTF
        'gltf',
        'glb',

        // images
        'apng',
        'bmp',
        'png',
        'jpe?g',
        'jfif',
        'pjpeg',
        'pjp',
        'gif',
        'svg',
        'ico',
        'webp',
        'avif',
        'cur',
        'jxl',

        // media
        'mp4',
        'webm',
        'ogg',
        'mp3',
        'wav',
        'flac',
        'aac',
        'opus',
        'mov',
        'm4a',
        'vtt',

        // fonts
        'woff2?',
        'eot',
        'ttf',
        'otf',

        // other
        'webmanifest',
        'pdf',
        'txt',
      ].join('|') +
      `)(\\?.*)?$`,
    'i',
  ),
  test: {
    environment: 'happy-dom',
  },
})
