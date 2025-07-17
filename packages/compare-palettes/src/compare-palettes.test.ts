import { expect, test } from 'vitest'

import { getClosestPaletteIndex, getSinglePaletteSortedIndices } from './compare-palettes'

const RED_PALETTE = [
  { R: 190, G: 0, B: 0 },
  { R: 50, G: 0, B: 0 },
  { R: 200, G: 0, B: 0 },
  { R: 255, G: 0, B: 0 },
  { R: 250, G: 0, B: 0 },
]

const PURPLE_PALETTE = [
  { R: 190, G: 0, B: 125 },
  { R: 50, G: 0, B: 125 },
  { R: 200, G: 0, B: 125 },
  { R: 250, G: 0, B: 125 },
  { R: 255, G: 0, B: 125 },
]

const GREEN_PALETTE = [
  { R: 40, G: 255, B: 125 },
  { R: 50, G: 0, B: 125 },
  { R: 30, G: 125, B: 125 },
  { R: 20, G: 12, B: 125 },
  { R: 10, G: 240, B: 125 },
]

test('sort single palette', () => {
  expect(getSinglePaletteSortedIndices(RED_PALETTE)).toEqual([2, 4, 3, 1, 0])
})

test('get closest palette', () => {
  expect(() => getClosestPaletteIndex([], [])).toThrow()

  expect(getClosestPaletteIndex([], [RED_PALETTE, PURPLE_PALETTE])).toEqual(0)
  expect(getClosestPaletteIndex([{ R: 0, G: 0, B: 0 }], [RED_PALETTE, PURPLE_PALETTE])).toEqual(0)

  expect(
    getClosestPaletteIndex([{ R: 255, G: 125, B: 0 }], [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE]),
  ).toEqual(0)
  expect(
    getClosestPaletteIndex([{ R: 255, G: 0, B: 255 }], [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE]),
  ).toEqual(1)
  expect(
    getClosestPaletteIndex([{ R: 0, G: 0, B: 255 }], [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE]),
  ).toEqual(1)
  expect(
    getClosestPaletteIndex([{ R: 0, G: 255, B: 255 }], [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE]),
  ).toEqual(2)
  expect(
    getClosestPaletteIndex([{ R: 125, G: 255, B: 0 }], [RED_PALETTE, PURPLE_PALETTE, GREEN_PALETTE]),
  ).toEqual(2)
})
