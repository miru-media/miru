/* eslint-disable import/no-relative-packages -- dev tooling */
import vue from '@vitejs/plugin-vue'
import { buildXDC } from '@webxdc/vite-plugins'

import { extendViteConfig } from '../../config/base-vite-config.ts'

export default extendViteConfig({
  root: import.meta.dirname,
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) =>
            tag === 'media-trimmer' || tag.startsWith('media-editor') || tag.startsWith('webgl-effects-'),
        },
      },
    }),
    buildXDC(),
  ],
})
