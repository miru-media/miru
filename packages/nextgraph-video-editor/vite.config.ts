/* eslint-disable import/no-extraneous-dependencies, import/no-relative-packages -- dev tooling */
import vue from '@vitejs/plugin-vue'
import markdown from 'unplugin-vue-markdown/vite'
import { defineConfig, mergeConfig } from 'vite'

import config from '../../vite.config.ts'

export default mergeConfig(
  config,
  defineConfig({
    root: import.meta.dirname,
    plugins: [
      vue({
        include: [/\.vue$/, /\.md$/],
        template: {
          compilerOptions: {
            isCustomElement: (tag) =>
              tag === 'media-trimmer' || tag.startsWith('media-editor') || tag.startsWith('webgl-effects-'),
          },
        },
      }),
      markdown({}),
    ],
  }),
)
