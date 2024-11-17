import { createRollupConfig } from '../../tools/createRollupConfig.js'

export default createRollupConfig({
  root: import.meta.dirname,
  inputs: {
    'image-editor': 'index.ts',
    vue2: 'vue2/index.ts',
  },
  external: [],
})
