import type { Plugin } from 'vite'

/**
 * https://github.com/vitejs/vite/discussions/8825#discussioncomment-4284803
 *
 * @returns Vite plugin
 */
export const cssModuleHmr = (): Plugin => {
  /** Use stable css names in dev mode */
  let counter = 0
  const map = new Map<string, number>()

  return {
    name: 'dev:css-module-hmr',
    apply: 'serve',
    enforce: 'post',
    config(config) {
      if (config.css?.modules === false) return

      const generateScopedName = (name: string, filename: string): string => {
        if (!map.has(filename)) this.info(filename)
        if (!map.has(filename)) map.set(filename, (counter += 1))
        return `${name}_${map.get(filename)}`
      }

      return { css: { modules: { generateScopedName } } }
    },
    transform(code, id) {
      if (!map.has(id)) return

      return `${code};import.meta.hot.accept()`
    },
  }
}
