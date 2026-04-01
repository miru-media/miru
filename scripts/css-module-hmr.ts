import type { EnvironmentModuleNode, Plugin } from 'vite'

/**
 * https://github.com/vitejs/vite/discussions/8825#discussioncomment-4284803
 *
 * @returns Vite plugin
 */
export const cssModuleHmr = (): Plugin => {
  /** Use stable css names in dev mode */
  let counter = 0
  const cssFileIdMap = new Map<string, number>()

  return {
    name: 'dev:css-module-hmr',
    apply: 'serve',
    enforce: 'post',
    config(config) {
      if (config.css?.modules === false) return

      // generate a stable CSS name by adding a suffix associated with the module id
      const generateScopedName = (name: string, filename: string): string => {
        if (!cssFileIdMap.has(filename)) cssFileIdMap.set(filename, (counter += 1))

        return `${name}_${cssFileIdMap.get(filename)}`
      }

      return { css: { modules: { generateScopedName } } }
    },
    transform(code, id) {
      if (!cssFileIdMap.has(id)) return
      // self-accepting module
      // https://vite.dev/guide/api-hmr#hot-accept-cb
      return `${code};import.meta.hot.accept()`
    },
    hotUpdate(ctx) {
      const updated = new Set<EnvironmentModuleNode>(ctx.modules)

      ctx.modules.forEach((mod) => {
        // mark updated root CSS modules as self-accepting
        if (mod.id && cssFileIdMap.has(mod.id)) {
          mod.isSelfAccepting = true
        }
        // for CSS files that are only @imported by CSS modules
        else if (!mod.id && Array.from(mod.importers).every(({ id }) => !!id && cssFileIdMap.has(id))) {
          // set the CSS modules as accepting the updated dependency and add them to the list of HMR updates
          mod.importers.forEach((importer) => {
            importer.acceptedHmrDeps.add(mod)
            importer.isSelfAccepting = true
            updated.add(importer)
          })
        }
      })

      return Array.from(updated)
    },
  }
}
