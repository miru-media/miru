const removeOptionalPeerDeps = (/** @type {any} */ pkg) => {
  Object.entries(pkg.peerDependenciesMeta).forEach((/** @type {[String, any]} */ [name, meta]) => {
    if (meta.optional === true) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- required
      delete pkg.peerDependencies[name]
    }
  })
}

module.exports = {
  hooks: {
    readPackage: (/** @type {any} */ pkg) => {
      const { name } = pkg
      if (/^(unplugin-icons|@vueuse\/integrations)$/.test(name)) removeOptionalPeerDeps(pkg)
      else if (name === 'yjs-orderedtree') {
        if (pkg.dependencies.global == null) throw new Error(`"yjs-orderedtree > global" dep doesn't exist.`)
        delete pkg.dependencies.global
      }
      return pkg
    },
  },
}
