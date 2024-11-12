import BeigeMom from '@/assets/luts/BeigeMom.png'
import swapBlueToYellow from '@/assets/luts/blue-to-yellow.png'
// import Broken from '@/assets/luts/Broken.png'
import BruceBanner from '@/assets/luts/BruceBanner.png'
import CartoonColorful from '@/assets/luts/CartoonColorful.png'
import CartoonColors from '@/assets/luts/CartoonColors.png'
import CartoonColorsPunchy from '@/assets/luts/CartoonColorsPunchy.png'
import CartoonPale from '@/assets/luts/CartoonPale.png'
import CartoonShadows from '@/assets/luts/CartoonShadows.png'
import CartoonSketch from '@/assets/luts/CartoonSketch.png'
import CartoonSketch_BW from '@/assets/luts/CartoonSketch_BW.png'
import CartoonVibrant from '@/assets/luts/CartoonVibrant.png'
// import Chaos from '@/assets/luts/Chaos.png'
import Freddy01 from '@/assets/luts/Freddy01.png'
import Freddy02 from '@/assets/luts/Freddy02.png'
import Freddy03 from '@/assets/luts/Freddy03.png'
import Freddy04 from '@/assets/luts/Freddy04.png'
import Freddy05 from '@/assets/luts/Freddy05.png'
import Freddy06 from '@/assets/luts/Freddy06.png'
import Freddy07 from '@/assets/luts/Freddy07.png'
import Freddy08 from '@/assets/luts/Freddy08.png'
import Freddy09 from '@/assets/luts/Freddy09.png'
import Freddy10 from '@/assets/luts/Freddy10.png'
import Freddy11 from '@/assets/luts/Freddy11.png'
import Freddy12 from '@/assets/luts/Freddy12.png'
import Freddy13 from '@/assets/luts/Freddy13.png'
import Freddy14 from '@/assets/luts/Freddy14.png'
import Freddy15 from '@/assets/luts/Freddy15.png'
import Freddy16 from '@/assets/luts/Freddy16.png'
import Freddy17 from '@/assets/luts/Freddy17.png'
import Freddy18 from '@/assets/luts/Freddy18.png'
import Freddy19 from '@/assets/luts/Freddy19.png'
import Freddy20 from '@/assets/luts/Freddy20.png'
import Freddy21 from '@/assets/luts/Freddy21.png'
import swapGreenToRed from '@/assets/luts/green-to-red.png'
import Pinky from '@/assets/luts/Pinky.png'
import PurplePleaser from '@/assets/luts/PurplePleaser.png'
import Skin from '@/assets/luts/Skin.png'
import Stocky from '@/assets/luts/Stocky.png'
import test from '@/assets/luts/test.png'
import { EffectOpType } from '@/constants'
import { AssetType, type Effect } from '@/types'

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
        // { type: EffectOpType.FILM_GRAIN, intensity: 0.7 },
        { type: EffectOpType.VIGNETTE, intensity: 0.5 },
      ],
    },
    {
      name: 'Green → Red',
      ops: [
        { type: EffectOpType.VIGNETTE, intensity: 0.25 },
        { type: EffectOpType.LUT, lut: rebaseAssetUrl(swapGreenToRed), intensity: 0.75 },
      ],
    },
    {
      name: 'Blue → Yellow',
      ops: [{ type: EffectOpType.LUT, lut: rebaseAssetUrl(swapBlueToYellow) }],
    },
    {
      name: 'Black',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.9, -1] },
        { type: EffectOpType.FILM_GRAIN, intensity: 0.5 },
        { type: EffectOpType.VIGNETTE, intensity: 0.2 },
      ],
    },
    {
      name: 'Black Soft',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.65, -1] },
        { type: EffectOpType.FILM_GRAIN, intensity: 0.5 },
        { type: EffectOpType.VIGNETTE, intensity: 0.2 },
      ],
    },
    {
      name: 'Beige Mom',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(BeigeMom), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Stocky',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Stocky), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Pinky',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Pinky), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },

    {
      name: 'Freddy01',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy01), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy02',
      ops: [
        { type: EffectOpType.VIGNETTE, intensity: 0.3 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy02), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy03',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy03), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy04',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy04), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy05',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy05), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy06',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy06), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy07',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy07), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy08',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy08), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy09',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy09), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy10',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy10), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy11',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy11), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy12',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy12), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy13',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy13), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy14',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy14), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy15',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy15), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy16',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy16), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy17',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy17), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy18',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy18), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy19',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy19), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy20',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy20), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Freddy21',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Freddy21), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },

    {
      name: 'Skin',
      // ops: [{ type: EffectOpType.TEST }],
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Skin), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
      // ops: [{ type: EffectOpType.TEST, args: [0, 0.65, 0] }],
    },

    {
      name: 'Test',
      // ops: [{ type: EffectOpType.TEST }],
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(test), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
      // ops: [{ type: EffectOpType.TEST, args: [0, 0.65, 0] }],
    },

    // new luts
    {
      name: 'Bruce Banner',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(BruceBanner), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },

    {
      name: 'Puple Pleaser',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(PurplePleaser), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    // {
    //   name: 'Broken',
    //   ops: [
    //     {
    //       type: EffectOpType.LUT,
    //       lut: { source: rebaseAssetUrl(Broken), type: AssetType.HaldLut },
    //       intensity: 0.75,
    //     },
    //   ],
    // },

    {
      name: 'CartoonColorful',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonColorful), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    {
      name: 'CartoonPale',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonPale), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    {
      name: 'CartoonSketch',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonSketch), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    {
      name: 'CartoonVibrant',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonVibrant), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    {
      name: 'CartoonShadows',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonShadows), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },

    {
      name: 'CartoonColors',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonColors), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'CartoonColorsPunchy',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonColorsPunchy), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },
    {
      name: 'CartoonSketch_BW',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(CartoonSketch_BW), type: AssetType.HaldLut },
          intensity: 0.75,
        },
      ],
    },

    // {
    //   name: 'Chaos',
    //   ops: [
    //     {
    //       type: EffectOpType.LUT,
    //       lut: { source: rebaseAssetUrl(Chaos), type: AssetType.HaldLut },
    //       intensity: 0.75,
    //     },
    //   ],
    // },
  ]
}
