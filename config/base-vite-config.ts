import { resolve } from 'node:path'

import basicSsl from '@vitejs/plugin-basic-ssl'
import vue from '@vitejs/plugin-vue'
import glslOptimize from 'rollup-plugin-glsl-optimize'
import { presetIcons, presetTypography, presetWind3 } from 'unocss'
import unocss from 'unocss/vite'
import autoImport from 'unplugin-auto-import/vite'
import icons from 'unplugin-icons/vite'
import { defineConfig, mergeConfig, type UserConfig } from 'vite'
import analyzer from 'vite-bundle-analyzer'
import remoteAssets from 'vite-plugin-remote-assets'

import { autoImportOptions } from '../scripts/auto-import-options.js'
import { cssModuleHmr } from '../scripts/css-module-hmr.ts'
import { globImportFrag } from '../scripts/glob-import-frag.js'

const isProd = process.env.NODE_ENV === 'production'

export const extendViteConfig = (config: UserConfig): UserConfig => {
  const baseConfig = defineConfig({
    logLevel: 'info',
    plugins: [
      cssModuleHmr(),
      autoImport(autoImportOptions),
      remoteAssets({
        // this is required to work with eleventy-vite-plugin
        assetsDir: resolve('node_modules', '.remote-assets'),
        awaitDownload: true,
        rules: [
          {
            match:
              /\b(?:https:\/\/(?:github\.com\/miru-media|upload\.wikimedia\.org|storage\.googleapis\.com\/mediapipe-models|commondatastorage\.googleapis\.com\/gtv-videos-bucket)\/.*?\.(?:webm|mp4|mp3|jpg|png|hdr|gltf|glb|task))(?=[`'")\]])/giu,
          },
        ],
      }),
      icons({
        compiler: 'jsx',
        jsx: 'preact',
        defaultClass: 'miru-icon',
        transform: (svg) => svg.replace('<svg', '<svg role="presentation"'),
      }),
      unocss({
        presets: [
          presetWind3({ dark: { dark: '.theme-dark', light: '.theme-light' } }),
          presetIcons(),
          presetTypography(),
        ],
        content: {
          pipeline: {
            include: [/\.(?:vue|svelte|[jt]sx)(?:$|\?)/u],
            exclude: resolve(import.meta.dirname, 'website/_site'),
          },
          filesystem: [resolve(import.meta.dirname, 'website/**/*.{css,md,mdx,tsx,html,njk}')],
        },
        shortcuts: {
          'task-done': 'inline-block align-middle i-tabler-circle-check-filled text-#30a46c',
          'task-wip': 'inline-block align-middle i-tabler-progress-check text-#da8b17',
          'task-todo': 'inline-block align-middle i-tabler-circle-dashed opacity-50',
        },
      }),
      globImportFrag(),
      glslOptimize({ optimize: isProd, compress: isProd, glslify: true }),
      !!process.env.BASIC_SSL && basicSsl(),
      !!process.env.BUNDLE_ANALYZER && analyzer({ openAnalyzer: false, analyzerPort: 5173 }),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) =>
              tag === 'media-trimmer' || tag.startsWith('media-editor') || tag.startsWith('webgl-effects-'),
          },
        },
      }),
    ],
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'fine-jsx',
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      // fully supports es6-module and fully supports webgl2
      target: ['chrome61', 'firefox60', 'safari11'],
      minify: isProd,
      sourcemap: true,
    },
    assetsInclude: new RegExp(
      `\\.(?:${[
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
      ].join('|')})(?:\\?.*)?$`,
      'iu',
    ),
  })

  return mergeConfig(baseConfig, config)
}
