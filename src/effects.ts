import swapGreenToRed from '@/assets/luts/green-to-red.png'
import swapBlueToYellow from '@/assets/luts/blue-to-yellow.png'
import { Effect } from '@/types'
import { EffectOpType } from '@/constants'

export const getDefaultFilters = (assetsPath?: string): Effect[] => {
  const rebaseAssetUrl = (path: string) =>
    assetsPath ? new URL(path, new URL(assetsPath, location.href)).href : path

  return [
    {
      name: 'Contrast',
      ops: [{ type: EffectOpType.ADJUST_COLOR, args: [0, 0.65, 0] }],
    },
    {
      name: 'Vintage',
      ops: [
        { type: EffectOpType.SEPIA },
        { type: EffectOpType.FILM_GRAIN, intensity: [0.5, 0.7] },
        { type: EffectOpType.VIGNETTE, intensity: [0.25, 0.5] },
      ],
    },
    {
      name: 'Green → Red',
      ops: [
        { type: EffectOpType.VIGNETTE, intensity: [0.1, 0.25] },
        { type: EffectOpType.LUT, lut: rebaseAssetUrl(swapGreenToRed), intensity: [0.25, 0.75] },
      ],
    },
    {
      name: 'Black',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.9, -1], intensity: [0.5, 1] },
        { type: EffectOpType.VIGNETTE, intensity: [0, 0.2] },
        { type: EffectOpType.FILM_GRAIN, intensity: [0.2, 0.5] },
      ],
    },
    {
      name: 'Blue to yellow',
      ops: [{ type: EffectOpType.LUT, lut: rebaseAssetUrl(swapBlueToYellow), intensity: [0.25, 1] }],
    },
    {
      name: 'Desaturate',
      ops: [{ type: EffectOpType.ADJUST_COLOR, args: [0, 0.5, -1] }],
    },
  ]
}
