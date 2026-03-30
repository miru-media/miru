import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { ROOT } from '../../scripts/utils.js'

export default (eleventyConfig: {
  addShortcode: (name: string, fn: (...args: any[]) => unknown) => void
}): void => {
  eleventyConfig.addShortcode(
    'customInclude',
    function (this: { page: Record<string, string> }, filename: string, regionName?: string): string {
      const resolvedPath = resolve(ROOT, this.page.inputPath, filename)
      if (!resolvedPath.startsWith(ROOT))
        throw new Error(`[customInclude] Can't include file outside root (${resolvedPath})`)
      const source = readFileSync(resolvedPath).toString()

      if (!regionName) return source

      const matchedContent = new RegExp(
        `<!-- *#region +${regionName} *-->(?<content>[\\s\\S]*)<!-- *#endregion +${regionName} *-->`,
        'um',
      ).exec(source)?.groups?.content

      if (matchedContent === undefined)
        throw new Error(`[customInclude] Region "${regionName}" missing from file ${filename}`)

      return matchedContent
    },
  )
}
