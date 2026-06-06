/* eslint-disable import/no-relative-packages -- dev tooling */
import { buildXDC } from '@webxdc/vite-plugins'

import { extendViteConfig } from '../../config/base-vite-config.ts'

export default extendViteConfig({
  root: import.meta.dirname,
  plugins: [buildXDC()],
})
