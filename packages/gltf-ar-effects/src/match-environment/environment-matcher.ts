import {
  type ColorLab,
  drawPalette,
  getClosestPaletteIndex,
  getImagePalette,
  paletteToLab,
  sortSinglePalette,
} from 'compare-palettes'

export interface EnvInfo {
  palette: ColorLab[]
  lightness: number
  url: string
}

export interface EnvMatcherOptions {
  environmentOptions: EnvInfo[]
}

export interface EnvMatcherResult {
  closestIndex: number
  closestEnv: EnvInfo
  palette: ColorLab[]
  lightnessRatio: number
  sortedCollection: ColorLab[][]
}

const DRAW_SIZE = 50

const getPalette = (image: Exclude<CanvasImageSource, SVGElement>, length: number) =>
  sortSinglePalette(paletteToLab(getImagePalette(image, length, false)))

const getLightness = (palette: ColorLab[]) =>
  palette.reduce((acc, color) => acc + color.L / palette.length, 0)

export class EnvMatcher extends EventTarget {
  readonly envs: EnvInfo[]
  private readonly paletteLength: number
  result?: EnvMatcherResult

  debug?: {
    inputContext: CanvasRenderingContext2D
    collectionContexts: CanvasRenderingContext2D[]
    element: HTMLElement
    img: HTMLImageElement
  }

  constructor(options: EnvMatcherOptions) {
    super()

    this.envs = options.environmentOptions
    this.paletteLength = this.envs[0].palette.length

    if (
      !!(import.meta.env.VITE_SHOW_ENV_MATCHER_DEBUG as string | undefined) &&
      !(import.meta.env.TEST as boolean)
    ) {
      const inputContext = document.createElement('canvas').getContext('2d')!
      const element = document.createElement('div')
      const collectionContexts: CanvasRenderingContext2D[] = []
      const img = new Image()

      img.width = DRAW_SIZE * 4
      element.appendChild(img)
      element.appendChild(inputContext.canvas)

      this.envs.forEach(({ palette, url }) => {
        const img = new Image(DRAW_SIZE * 2)
        img.src = url
        element.appendChild(img)

        const context = document.createElement('canvas').getContext('2d')!
        element.appendChild(context.canvas)
        collectionContexts.push(context)
        drawPalette(palette, context, DRAW_SIZE)
      })

      this.debug = { element, inputContext, collectionContexts, img }
    }
  }

  matchImage(image: Exclude<CanvasImageSource, SVGElement>): EnvMatcherResult {
    const inputPalette = getPalette(image, this.paletteLength)

    return this.matchPalette(inputPalette)
  }

  updateLightnessRatio(image: Exclude<CanvasImageSource, SVGElement>): number {
    const { result } = this
    if (!result) return 1

    const lightness = getLightness(getPalette(image, this.paletteLength))

    return (result.lightnessRatio = lightness / result.closestEnv.lightness)
  }

  matchPalette(palette: ColorLab[]): EnvMatcherResult {
    const { closestIndex, sortedCollection } = getClosestPaletteIndex(
      palette,
      this.envs.map((p) => p.palette),
    )

    const closestEnv = this.envs[closestIndex]

    if (import.meta.env.DEV && this.debug) {
      const { inputContext, collectionContexts } = this.debug
      drawPalette(palette, inputContext, DRAW_SIZE)
      sortedCollection.forEach((otherPalette, i) =>
        drawPalette(otherPalette, collectionContexts[i], DRAW_SIZE),
      )
      this.debug.img.src = closestEnv.url
    }

    const lightnessRatio = getLightness(palette) / closestEnv.lightness
    const result = { closestIndex, closestEnv, palette, sortedCollection, lightnessRatio }
    const changed = this.result?.closestIndex !== result.closestIndex

    this.result = result
    if (changed) this.dispatchEvent(new Event('change'))
    this.dispatchEvent(new Event('update'))

    return result
  }
}
