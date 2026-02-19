import { resolve } from 'node:path'

import globImport from 'rollup-plugin-glob-import'

export const globImportFrag = () =>
  globImport({
    format: 'default',
    include: [
      resolve(import.meta.dirname, '../packages/webgl-effects/src/all-fragment-shaders.ts'),
      resolve(import.meta.dirname, '../packages/webgl-video-editor/src/pixi/pixi-miru-filter.ts'),
    ],
    rename: (name, id) => {
      if (name) throw new Error('Unexpected named import.')
      return id.replace(/.*\//, '').replaceAll('-', '_').replace(/\..*$/, '')
    },
  })
