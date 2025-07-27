import * as colorDiff from 'color-diff'

import tsp from './tsp-lin-kernighan.js'
import { computeDistanceMatrix, getColorDistanceToLineSegment, paletteToLab } from './utils.js'

/**
 * @import { ColorLab, DistanceMatrix, Palette } from '.'
 */

/**
 *
 * @param {Palette} palette
 * @returns {number[]}
 */
export const getSinglePaletteSortedIndices = (palette) => {
  const paletteLab = paletteToLab(palette)

  const { length } = palette
  if (length <= 2) return palette.map((_, i) => i)

  const distanceMatrix = computeDistanceMatrix(paletteLab, colorDiff.diff)
  const tour = tsp(distanceMatrix)
  const cutTourAt = getCutIndex(tour, distanceMatrix)

  return tour.slice(cutTourAt).concat(tour.slice(0, cutTourAt))
}

/**
 *
 * @param {number[]} tour
 * @param {DistanceMatrix} distanceMatrix
 * @returns {number}
 */
const getCutIndex = (tour, distanceMatrix) => {
  const { length } = tour
  let cutTourAt = 1
  let greatestDistance = distanceMatrix[tour[0]][tour[1]]

  for (let tourIndex = 2; tourIndex < length; tourIndex++) {
    const index = tour[tourIndex]
    const distance = distanceMatrix[index][index - 1]

    if (distance > greatestDistance) {
      cutTourAt = tourIndex
      greatestDistance = distance
    }
  }

  return cutTourAt
}

/**
 * @param {Palette[]} palettes
 * @returns {number[][]}
 */
export const getMultiplePalettesSortedIndices = (palettes) => {
  const combinedLength = palettes.reduce((acc, p) => acc + p.length, 0)
  /** @type {Palette} */
  const combinedPalette = new Array(combinedLength)
  /** @type {[paletteIndex: number, colorIndex: number][]} */
  const indexMap = new Array(combinedLength)

  /** @type {number[][]} */
  const sortedPalettesIndices = []

  let combinedIndex = 0

  palettes.forEach((palette, paletteIndex) => {
    for (let colorIndex = 0; colorIndex < palette.length; colorIndex++) {
      combinedPalette[combinedIndex] = palette[colorIndex]
      indexMap[combinedIndex] = [paletteIndex, colorIndex]
      combinedIndex++
    }

    sortedPalettesIndices[paletteIndex] = []
  })

  const combinedTour = getSinglePaletteSortedIndices(combinedPalette)

  for (let i = 0; i < combinedLength; i++) {
    const combinedPaletteIndex = combinedTour[i]
    const { 0: paletteIndex, 1: colorIndex } = indexMap[combinedPaletteIndex]

    sortedPalettesIndices[paletteIndex].push(colorIndex)
  }

  return sortedPalettesIndices
}

/**
 * @template {Palette} T
 * @param {T} palette
 * @returns {T[number][]}
 */
export const sortSinglePalette = (palette) => getSinglePaletteSortedIndices(palette).map((i) => palette[i])

/**
 * @template {Palette} T
 * @param {T[]} palettes
 * @returns {T[]}
 */
export const sortMultiplePalettes = (palettes) =>
  /** @type T[] */ (
    getMultiplePalettesSortedIndices(palettes).map((sorted, combinedIndex) =>
      sorted.map((i) => palettes[combinedIndex][i]),
    )
  )

/**
 * @param {ColorLab} color
 * @param {ColorLab[]} sortedPalette
 * @returns {number}
 */
const getMinDistanceToLineSegment = (color, sortedPalette) => {
  let minDistance = Infinity
  const paletteLength = sortedPalette.length

  for (let i = 0; i < paletteLength; i++) {
    const distance = getColorDistanceToLineSegment(
      color,
      sortedPalette[i],
      sortedPalette[(i + 1) % paletteLength],
    )
    if (distance < minDistance) minDistance = distance
  }

  return minDistance
}

/**
 *
 * @param {ColorLab[]} palette
 * @param {ColorLab[][]} collection
 * @returns {{ closestIndex: number, distance: number, sortedCollection: ColorLab[][] }}
 */
export const getClosestPaletteIndex = (palette, collection) => {
  const collectionLength = collection.length
  let closestIndex = 0

  if (collectionLength === 0) throw new Error('Unexpected empty palette collection')

  const paletteLength = palette.length

  /** @type {typeof collection} */
  const sortedCollection = []

  let minPaletteDistance = Infinity

  for (let collectionIndex = 0; collectionIndex < collectionLength; collectionIndex++) {
    const otherPalette = collection[collectionIndex]
    const otherPaletteLength = otherPalette.length
    let totalDistance = 0

    const [sorted, otherSorted] = sortMultiplePalettes([palette, otherPalette])
    sortedCollection.push(otherSorted)

    if (paletteLength !== otherPaletteLength) throw new Error(`Can't compare palettes of different lengths`)

    for (let paletteColorIndex = 0; paletteColorIndex < paletteLength; paletteColorIndex++) {
      totalDistance += getMinDistanceToLineSegment(sorted[paletteColorIndex], otherPalette)
      totalDistance += getMinDistanceToLineSegment(otherPalette[paletteColorIndex], sorted)
    }

    if (totalDistance < minPaletteDistance) {
      minPaletteDistance = totalDistance
      closestIndex = collectionIndex
    }
  }

  return { closestIndex, distance: minPaletteDistance, sortedCollection }
}
