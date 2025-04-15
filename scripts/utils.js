import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { globSync } from 'glob'
import spawn from 'nano-spawn'

export const ROOT = resolve(import.meta.dirname, '..')

export const getPublickPackageDirs = () =>
  globSync(join(ROOT, 'packages', '*', 'package.json'))
    .filter((p) => {
      const pkg = /** @type {{ private?: boolean }} */ (JSON.parse(readFileSync(p).toString()))
      return !pkg.private
    })
    .map((p) => dirname(p))

/**
 * @param {string} file
 * @param {readonly string[] | undefined} args
 */
export async function run(file, args) {
  console.info(file, ...(args ?? []))
  await spawn(file, args, { stdio: 'inherit' })
}
