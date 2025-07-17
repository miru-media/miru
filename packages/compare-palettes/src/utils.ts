import * as colorDiff from 'color-diff'

import type { ColorLab, Palette } from './types'

export const paletteToLab = (palette: Palette): ColorLab[] =>
  palette.map((color) => ('L' in color ? color : colorDiff.rgb_to_lab(color)))

export const computeDistanceMatrix = <T>(
  points: T[],
  getDistance: (a: T, b: T) => number,
): Float32Array[] => {
  const { length } = points

  if (length === 0) return []
  if (length === 1) return [new Float32Array([0])]

  const matrix: Float32Array[] = []

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

// https://stackoverflow.com/a/6853926
export const getColorDistanceToLineSegment = (
  color: ColorLab,
  other1: ColorLab,
  other2: ColorLab,
): number => {
  const A = color.L - other1.L
  const B = color.a - other1.a
  const C = color.b - other1.b

  const D = other2.L - other1.L
  const E = other2.a - other1.a
  const F = other2.b - other1.b

  const dot = A * D + B * E + C * F
  const lenSq = D * D + E * E + F * F

  let param = -1
  // in case of 0 length line
  if (lenSq !== 0) param = dot / lenSq

  let xx: number
  let yy: number

  if (param < 0) {
    xx = other1.L
    yy = other1.a
  } else if (param > 1) {
    xx = other2.L
    yy = other2.a
  } else {
    xx = other1.L + param * D
    yy = other1.a + param * E
  }

  const dx = color.L - xx
  const dy = color.a - yy
  return Math.sqrt(dx * dx + dy * dy)
}
