import fs from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { extendViteConfig } from '../config/base-vite-config.ts'

const WEBSITE_DIR = import.meta.dirname

export default extendViteConfig({
  plugins: [
    {
      name: 'app:resolve-eleventy-website-content-scripts',
      resolveId(id, importer): Promise<string | undefined> | undefined {
        if (!importer || !resolve(importer).startsWith(WEBSITE_DIR)) return

        const resolved = isAbsolute(id)
          ? join(WEBSITE_DIR, 'content', id)
          : resolve(WEBSITE_DIR, dirname(importer.replace('.11ty-vite/', 'content/')), id)

        return fs
          .access(resolved)
          .then(() => {
            this.addWatchFile(resolved)
            return resolved
          })
          .catch(() => undefined)
      },
    },
  ],
})
