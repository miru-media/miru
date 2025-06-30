import unpluginIconResolver from 'unplugin-icons/resolver'

const iconResolver = () => {
  const baseResolver = unpluginIconResolver({
    prefix: 'Icon',
    extension: 'jsx',
  })

  return (/** @type {string} */ name) => {
    // https://github.com/unplugin/unplugin-icons/issues/317
    // Camel to kebab case doesn't work for icons like crop-1-1
    // so we use underscore
    return baseResolver(name)?.replace(/_/g, '-')
  }
}

export const autoImportOptions = {
  resolvers: [iconResolver()],
  eslintrc: { enabled: false },
}
