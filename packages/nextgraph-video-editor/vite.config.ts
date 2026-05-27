/* eslint-disable import/no-relative-packages -- dev tooling */
import { extendViteConfig } from '../../config/base-vite-config.ts'

export default extendViteConfig({
  root: import.meta.dirname,
  base: '/nextgraph',
})
