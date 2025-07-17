import * as colorDiff from 'color-diff'

import tsp from './tsp-lin-kernighan'
import type { ColorLab, ColorRGB, Palette } from './types'
import { computeDistanceMatrix, getColorDistanceToLineSegment, paletteToLab } from './utils'

export const getSinglePaletteSortedIndices = (palette: (ColorRGB | ColorLab)[]): number[] => {
  const paletteLab = paletteToLab(palette)

  const { length } = palette
  if (length <= 2) return palette.map((_, i) => i)

  const distanceMatrix = computeDistanceMatrix(paletteLab, colorDiff.diff)
  const tour = tsp(distanceMatrix)
  const cutTourAt = getCutIndex(tour, distanceMatrix)

  return tour.slice(cutTourAt).concat(tour.slice(0, cutTourAt))
}

const getCutIndex = (tour: number[], distanceMatrix: ArrayLike<number>[]): number => {
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

export const getMultiplePalettesSortedIndices = (palettes: Palette[]): number[][] => {
  const combinedLength = palettes.reduce((acc, p) => acc + p.length, 0)
  const combinedPalette = new Array<ColorRGB | ColorLab>(combinedLength)
  const indexMap = new Array<[paletteIndex: number, colorIndex: number]>(combinedLength)

  const sortedPalettesIndices: number[][] = []

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

export const getClosestPaletteIndex = (palette: Palette, collection: Palette[]): number => {
  const collectionLength = collection.length

  if (collectionLength === 0) throw new Error('Empty palette')
  if (collectionLength === 1) return 0

  const allPalettes = [paletteToLab(palette), ...collection.map(paletteToLab)]
  const [sortedPalette, ...collectionOfSorted] = getMultiplePalettesSortedIndices(allPalettes).map(
    (sortedIndices, p) => {
      const palette = allPalettes[p]
      return sortedIndices.map((i) => palette[i])
    },
  )

  const paletteLength = palette.length
  let minDistance = Infinity
  let closestIndex = 0

  for (let collectionIndex = 0; collectionIndex < collectionLength; collectionIndex++) {
    const otherPalette = collectionOfSorted[collectionIndex]
    const otherPaletteLength = otherPalette.length
    let totalDistance = 0

    for (let paletteColorIndex = 0; paletteColorIndex < paletteLength; paletteColorIndex++) {
      let minDistance = Infinity

      for (let i = 0; i < otherPaletteLength; i++) {
        const distance = getColorDistanceToLineSegment(
          sortedPalette[paletteColorIndex],
          otherPalette[i],
          otherPalette[(i + 1) % otherPaletteLength],
        )
        if (distance < minDistance) minDistance = distance
      }
      totalDistance += minDistance
    }

    if (totalDistance < minDistance) {
      minDistance = totalDistance
      closestIndex = collectionIndex
    }
  }

  return closestIndex
}
