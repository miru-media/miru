import { expect, test } from 'vitest'

import { computeDistanceMatrix } from './utils'

test('labDistanceMatrix', () => {
  const diff = (a: number, b: number): number => Math.abs(a - b)

  expect(computeDistanceMatrix([], diff)).toEqual([])

  expect(computeDistanceMatrix([100], diff)).toEqual([new Float32Array([0])])

  expect(computeDistanceMatrix([100, 20], diff)).toEqual([
    new Float32Array([0, 80]),
    new Float32Array([80, 0]),
  ])

  expect(computeDistanceMatrix([100, 20, 75, 10], diff)).toEqual([
    new Float32Array([0, 80, 25, 90]),
    new Float32Array([80, 0, 55, 10]),
    new Float32Array([25, 55, 0, 65]),
    new Float32Array([90, 10, 65, 0]),
  ])
})
