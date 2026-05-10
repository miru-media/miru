/* eslint-disable import/no-extraneous-dependencies, import/no-relative-packages -- dev tooling */
import markdown from 'unplugin-vue-markdown/vite'

import { extendViteConfig } from '../../config/base-vite-config.ts'

export default extendViteConfig({
  root: import.meta.dirname,
  base: '/nextgraph',
  plugins: [markdown({})],
})
