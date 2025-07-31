import globImport from 'rollup-plugin-glob-import'

export const globImportFrag = () =>
  globImport({
    format: 'default',
    include: '**/all-fragment-shaders.ts',
    rename: (name, id) => {
      if (name) throw new Error('Unexpected named import.')
      return id.replace(/.*\//, '').replaceAll('-', '_').replace(/\..*$/, '')
    },
  })
