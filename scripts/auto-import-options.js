import { resolve } from 'node:path'

import unpluginIconResolver from 'unplugin-icons/resolver'

import { ROOT } from './utils.js'

const iconResolver = () => {
  const baseResolver = unpluginIconResolver({
    prefix: 'Icon',
    extension: 'jsx',
    alias: { ms: 'material-symbols' },
  })

  return (/** @type {string} */ name) =>
    // https://github.com/unplugin/unplugin-icons/issues/317
    // Camel to kebab case doesn't work for icons like crop-1-1
    // so we use underscore
    baseResolver(name)?.replaceAll('_', '-')
}

export const autoImportOptions = {
  resolvers: [iconResolver()],
  dts: resolve(ROOT, 'auto-imports.d.ts'),
  eslintrc: { enabled: false },
}
