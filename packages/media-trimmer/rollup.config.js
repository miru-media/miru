import { createRollupConfig } from '../../tools/createRollupConfig.js'

export default createRollupConfig({
  root: import.meta.dirname,
  inputs: {
    'media-trimmer': 'index.ts',
    vue2: 'vue2.ts',
  },
  external: ['mp4box', 'mp4-muxer'],
})
