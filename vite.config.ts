import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import NodeGlobalsPolyfill from '@esbuild-plugins/node-globals-polyfill'
import basicSsl from '@vitejs/plugin-basic-ssl'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import { presetIcons, presetWind3 } from 'unocss'
import unocss from 'unocss/vite'
import autoImport from 'unplugin-auto-import/vite'
import icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import analyzer from 'vite-bundle-analyzer'
import remoteAssets from 'vite-plugin-remote-assets'

import { autoImportOptions } from './scripts/auto-import-ptions.js'
import { globImportFrag } from './scripts/glob-import-frag.js'

const isProd = process.env.NODE_ENV === 'production'

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [
    autoImport(autoImportOptions),
    remoteAssets({
      awaitDownload: true,
      rules: [
        {
          match:
            /\b(https:\/\/(github.com\/miru-media|upload.wikimedia.org|storage.googleapis.com\/mediapipe-models|commondatastorage.googleapis.com\/gtv-videos-bucket)\/.*?\.(?:webm|mp4|mp3|jpg|png|hdr|gltf|glb|task))(?=[`'")\]])/gi,
        },
      ],
    }),
    icons({ compiler: 'jsx', jsx: 'preact', defaultClass: 'icon' }),
    unocss({
      presets: [presetWind3(), presetIcons()],
      content: {
        pipeline: {
          include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/],
        },
        filesystem: [resolve('docs/parts/**/*.md')],
      },
      shortcuts: {
        'task-done': 'inline-block align-middle i-tabler-circle-check-filled text-$vp-c-success-2',
        'task-wip': 'inline-block align-middle i-tabler-progress-check text-$vp-c-warning-2',
        'task-todo': 'inline-block align-middle i-tabler-circle-dashed text-$vp-c-text-2',
      },
    }),
    globImportFrag(),
    glslOptimize({ optimize: !isProd, compress: isProd, glslify: true }),
    !!process.env.BASIC_SSL && basicSsl(),
    !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
  ],
  resolve: {
    alias: {
      ebml: require.resolve('ebml/lib/ebml.umd.js'),
      'virtual:image-shadow.css': resolve(
        import.meta.dirname,
        'packages/webgl-media-editor/src/index.css?inline',
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
