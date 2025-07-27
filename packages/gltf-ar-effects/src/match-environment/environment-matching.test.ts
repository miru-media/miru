import { expect, test } from 'vitest'

import { EnvMatcher } from './environment-matcher'

test('EnvMatcher', () => {
  const matcher = new EnvMatcher({
    environmentOptions: [
      { url: 'a', palette: [{ L: 100, a: 0, b: 0 }], lightness: 100 },
      { url: 'b', palette: [{ L: 50, a: 50, b: 50 }], lightness: 50 },
    ],
  })

  {
    const { closestIndex, lightnessRatio } = matcher.matchPalette([{ L: 100, a: 0, b: 0 }])
    expect(closestIndex).toBe(0)
    expect(lightnessRatio).toBe(1)
  }

  {
    const { closestIndex, lightnessRatio } = matcher.matchPalette([{ L: 75, a: 0, b: 0 }])
    expect(closestIndex).toBe(0)
    expect(lightnessRatio).toBe(0.75)
  }

  {
    const { closestIndex, lightnessRatio } = matcher.matchPalette([{ L: 25, a: 50, b: 50 }])
    expect(closestIndex).toBe(1)
    expect(lightnessRatio).toBe(0.5)
  }
})
