import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { globSync } from 'glob'

export const ROOT = resolve(import.meta.dirname, '..')

export const getPublickPackageDirs = () =>
  globSync(join(ROOT, 'packages', '*', 'package.json'))
    .filter((p) => {
      const pkg = /** @type {{ private?: boolean }} */ (JSON.parse(readFileSync(p).toString()))
      return !pkg.private
    })
    .map((p) => dirname(p))
