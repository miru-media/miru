import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { inspect } from 'node:util'

import sharp from 'sharp'

import {
  getImagePalette,
  getMultiplePalettesSortedIndices,
  paletteToLab,
  sortSinglePalette,
} from 'compare-palettes'

import { ROOT } from '../scripts/utils.js'

const URLS = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Fredenbaumpark_Panorama.jpg/1024px-Fredenbaumpark_Panorama.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Roter-Schirm_Panorama.jpg/1024px-Roter-Schirm_Panorama.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/HUSUM_HAFEN_Abend_01_Panorama.jpg/1024px-HUSUM_HAFEN_Abend_01_Panorama.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Verkleinert_Orgelempore_Dorfkirche_Hohen_Neuendorf.jpg/1024px-Verkleinert_Orgelempore_Dorfkirche_Hohen_Neuendorf.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Herne_Wanne_Tunnel_06_Panorama.jpg/1024px-Herne_Wanne_Tunnel_06_Panorama.jpg',
]

const PALETTE_LENGTH = 12
const CACHE_DIR = resolve(ROOT, 'node_modules', '.cache', 'miru', 'envmaps')

export default async ({ imageUrls = URLS } = {}) => {
  await mkdir(CACHE_DIR, { recursive: true })

  const paletteCollection = await Promise.all(
    imageUrls.map(async (url) => {
      const fileName = decodeURIComponent(url).replace(/.*\/\d+px-/, '')
      const filePath = resolve(CACHE_DIR, fileName)
      let input

      try {
        input = await readFile(filePath)
      } catch {
        input = await (await fetch(url)).arrayBuffer()
        await writeFile(filePath, new DataView(input))
      }

      const rawRgba = await sharp(input).ensureAlpha().raw().toBuffer()

      const unsorted = getImagePalette(new Uint8ClampedArray(rawRgba.buffer), PALETTE_LENGTH, false)
      const palette = sortSinglePalette(paletteToLab(unsorted))
      const lightness = palette.reduce((acc, color) => acc + color.L / palette.length, 0)

      return { url, fileName, palette, lightness }
    }),
  )

  getMultiplePalettesSortedIndices(paletteCollection.map((item) => item.palette)).forEach(
    (sortedIndices, paletteIndex) => {
      const unsorted = paletteCollection[paletteIndex].palette
      paletteCollection[paletteIndex].palette = sortedIndices.map((i) => unsorted[i])
    },
  )

  const code = `
  ${paletteCollection.map((palette, i) => `import palette${i} from ${JSON.stringify(palette.url)}`).join('\n')}
  export const PALETTE_LENGTH = ${JSON.stringify(PALETTE_LENGTH)}
  export default [
  ${paletteCollection
    .map((item, i) => {
      const filename = JSON.stringify(item.fileName)
      const palette = inspect(item.palette, { depth: Infinity, colors: false })
      const lightness = JSON.stringify(item.lightness)
      return `{ url: palette${i}, filename: ${filename}, palette: ${palette}, lightness: ${lightness} }`
    })
    .join(',\n')}
  ]`

  return code
}
