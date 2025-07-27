import { rgb_to_lab } from 'color-diff'
import { describe, expect, test } from 'vitest'

import type { ColorLab, ColorRGB } from "."

import { getClosestPaletteIndex, getSinglePaletteSortedIndices } from './compare-palettes'
import { paletteToLab } from './utils'

const RED_PALETTE = paletteToLab([
  { R: 190, G: 0, B: 0 },
  { R: 50, G: 0, B: 0 },
  { R: 200, G: 0, B: 0 },
  { R: 255, G: 0, B: 0 },
  { R: 250, G: 0, B: 0 },
])

const GREEN_PALETTE = paletteToLab([
  { R: 40, G: 255, B: 125 },
  { R: 50, G: 0, B: 125 },
  { R: 30, G: 125, B: 125 },
  { R: 20, G: 12, B: 125 },
  { R: 10, G: 240, B: 125 },
])

const BLUE_PALETTE = paletteToLab([
  { R: 30, G: 10, B: 180 },
  { R: 50, G: 0, B: 125 },
  { R: 0, G: 10, B: 100 },
  { R: 20, G: 0, B: 125 },
  { R: 30, G: 40, B: 210 },
])

const PURPLE_PALETTE = paletteToLab([
  { R: 190, G: 0, B: 125 },
  { R: 50, G: 0, B: 125 },
  { R: 200, G: 0, B: 125 },
  { R: 250, G: 0, B: 125 },
  { R: 255, G: 0, B: 125 },
])

test('sort single palette', () => {
  expect(getSinglePaletteSortedIndices(RED_PALETTE)).toEqual([1, 0, 2, 4, 3])
})

const repeat = <T>(item: T, n: number): T[] => new Array<T>(n).fill(item)

describe('get closest palette', () => {
  expect(() => getClosestPaletteIndex([], [])).toThrow()

  const N = 5

  expect(() => getClosestPaletteIndex([], [RED_PALETTE, PURPLE_PALETTE])).toThrow()

  test.for([
    ['black     ', { R: 0, G: 0, B: 0 }, [RED_PALETTE, PURPLE_PALETTE], 0],
    ['red-green ', { R: 255, G: 125, B: 0 }, [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE], 0],
    ['purple    ', { R: 255, G: 0, B: 255 }, [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE], 1],
    ['blue      ', { R: 0, G: 0, B: 255 }, [RED_PALETTE, BLUE_PALETTE, PURPLE_PALETTE, GREEN_PALETTE], 1],
    ['green-blue', { R: 0, G: 255, B: 255 }, [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE], 2],
    ['green-red ', { R: 125, G: 255, B: 0 }, [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE], 2],
  ] as [string, ColorRGB, ColorLab[][], number][])('compare %s', ([, rgb, otherPalettes, expected]) =>
    expect(getClosestPaletteIndex(repeat(rgb_to_lab(rgb), N), otherPalettes).closestIndex).toEqual(expected),
  )
})
