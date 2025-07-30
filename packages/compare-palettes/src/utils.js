import quantize from '@lokesh.dhakar/quantize'
import * as colorDiff from 'color-diff'

/**
 * @import { ColorLab, ColorRGB, Palette } from '.'
 */

/**
 * @param {Palette} palette
 * @returns {ColorLab[]}
 */
export const paletteToLab = (palette) =>
  palette.map((color) => ('L' in color ? color : colorDiff.rgb_to_lab(color)))

/**
 * @template T
 * @param {T[]} points
 * @param {(a: T, b: T) => number} getDistance
 * @returns { Float32Array[] }
 */
export const computeDistanceMatrix = (points, getDistance) => {
  const { length } = points

  if (length === 0) return []
  if (length === 1) return [new Float32Array([0])]

  /** @type {Float32Array[]} */
  const matrix = []

  for (let rowIndex = 0; rowIndex < length; rowIndex++) {
    const row = (matrix[rowIndex] = new Float32Array(length))

    for (let c = 0; c < length; c++) {
      if (c < rowIndex) row[c] = matrix[c][rowIndex]
      else if (c === rowIndex) row[c] = 0
      else row[c] = getDistance(points[rowIndex], points[c])
    }
  }

  return matrix
}

/**
 * @param {Exclude<CanvasImageSource, SVGElement> | Uint8ClampedArray} image
 * @param {number} length
 * @param {boolean} quantized
 * @returns {ColorRGB[]}
 */
export const getImagePalette = (image, length, quantized) => {
  const sourcePixels = getImagePixelArray(image)
  const sourceLength = sourcePixels.length
  /** @type {typeof sourcePixels} */
  let reducedPixels

  if (quantized) {
    const colorMap = quantize(sourcePixels, length)
    if (colorMap === false) throw new Error(`Couldn't extract palette`)
    reducedPixels = colorMap.palette()
  } else {
    reducedPixels = []

    for (let i = 0; i < length; i++) {
      reducedPixels.push(sourcePixels[Math.trunc((i * sourceLength) / length)])
    }
  }

  return reducedPixels.map((rgb) => ({ R: rgb[0], G: rgb[1], B: rgb[2] }))
}

const QUANTIZE_IMAGE_SIZE = { width: 50, height: 50 }

/** @type {OffscreenCanvas | HTMLCanvasElement | undefined} */
let canvas

/**
 * @param {Exclude<CanvasImageSource, SVGElement> | Uint8ClampedArray} image
 * @returns {[number, number, number][]}
 */
export const getImagePixelArray = (image) => {
  let data

  if (image instanceof Uint8ClampedArray) data = image
  else if (typeof ImageData !== 'undefined' && image instanceof ImageData) ({ data } = image)
  else {
    canvas ??=
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(QUANTIZE_IMAGE_SIZE.width, QUANTIZE_IMAGE_SIZE.height)
        : document.createElement('canvas')
    canvas.width = QUANTIZE_IMAGE_SIZE.width
    canvas.height = QUANTIZE_IMAGE_SIZE.height

    const context =
      /** @type {OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null} */
      (canvas.getContext('2d'))
    if (!context) throw new Error(`Couldn't get canvas context.`)

    let width = 0
    let height = 0

    if ('videoWidth' in image) ({ videoWidth: width, videoHeight: height } = image)
    else if ('codedWidth' in image) ({ codedWidth: width, codedHeight: height } = image)
    else ({ width, height } = image)

    context.drawImage(image, 0, 0, width, height, 0, 0, QUANTIZE_IMAGE_SIZE.width, QUANTIZE_IMAGE_SIZE.height)
    const imageData = context.getImageData(0, 0, QUANTIZE_IMAGE_SIZE.width, QUANTIZE_IMAGE_SIZE.height)
    ;({ data } = imageData)
  }

  const { byteLength } = data
  /** @type {[number, number, number][]} */
  const pixels = []

  for (let offset = 0; offset < byteLength; offset += 4)
    pixels.push([data[offset + 0], data[offset + 1], data[offset + 2]])

  return pixels
}

// https://stackoverflow.com/a/6853926
/**
 * @param {ColorLab} color
 * @param {ColorLab} other1
 * @param {ColorLab} other2
 * @returns {number}
 */
export const getColorDistanceToLineSegment = (color, other1, other2) => {
  const A = color.L - other1.L
  const B = color.a - other1.a
  const C = color.b - other1.b

  const D = other2.L - other1.L
  const E = other2.a - other1.a
  const F = other2.b - other1.b

  const dot = A * D + B * E + C * F
  const lenSq = D * D + E * E + F * F

  // in case of 0 length line
  const param = lenSq === 0 ? -1 : dot / lenSq

  /** @type {ColorLab} */
  let closest

  if (param < 0) closest = other1
  else if (param > 1) closest = other2
  else {
    closest = {
      L: other1.L + param * D,
      a: other1.a + param * E,
      b: other1.b + param * F,
    }
  }

  return colorDiff.diff(color, closest)
}

/**
 *
 * @param {ColorRGB[]|ColorLab[]} palette
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} context
 * @param {number} size
 * @returns {void}
 */
export const drawPalette = (palette, context, size) => {
  const { canvas } = context
  const width = palette.length * size
  const height = size

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  palette.forEach((color, i) => {
    context.fillStyle =
      'L' in color ? `lab(${color.L} ${color.a} ${color.b})` : `rgb(${color.R} ${color.G} ${color.B})`
    context.fillRect(i * size, 0, size, size)
  })
}
