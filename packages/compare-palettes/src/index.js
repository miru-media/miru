export * from './compare-palettes.js'
export * from './utils.js'

/**
 * @typedef {{
 *   R: number
 *   G: number
 *   B: number
 * }} ColorRGB
 *
 * @typedef {{
 *   L: number
 *   a: number
 *   b: number
 * }} ColorLab
 *
 * @typedef {(ColorRGB | ColorLab)[]} Palette
 *
 * @typedef {ArrayLike<number>[]} DistanceMatrix
 */
