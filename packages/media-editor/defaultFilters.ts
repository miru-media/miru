import Beige from '@/assets/luts/01_Warm/Beige.jpg'
import Fall from '@/assets/luts/01_Warm/Fall.jpg'
import Muted_Warm from '@/assets/luts/01_Warm/Muted_Warm.jpg'
import Pinky from '@/assets/luts/01_Warm/Pinky.jpg'
import Romantic from '@/assets/luts/01_Warm/Romantic.jpg'
import Bleach from '@/assets/luts/02_Bright/Bleach.jpg'
import Bleach_Blue from '@/assets/luts/02_Bright/Bleach_Blue.jpg'
import Stocky from '@/assets/luts/02_Bright/Stocky.jpg'
import Bright_Cyan from '@/assets/luts/03_Cyan/Bright_Cyan.jpg'
import Crispy_Cyan from '@/assets/luts/03_Cyan/Crispy_Cyan.jpg'
import Blue_to_Yellow from '@/assets/luts/04_Color/Blue_to_Yellow.jpg'
import Bruce_Banner from '@/assets/luts/04_Color/Bruce_Banner.jpg'
import Green_to_Red from '@/assets/luts/04_Color/Green_to_Red.jpg'
import Metallic from '@/assets/luts/04_Color/Metallic.jpg'
import Orange_Cyan from '@/assets/luts/04_Color/Orange_Cyan.jpg'
import Pink from '@/assets/luts/04_Color/Pink.jpg'
import Purple_Dreams from '@/assets/luts/04_Color/Purple_Dreams.jpg'
import Purple_Please from '@/assets/luts/04_Color/Purple_Please.jpg'
import Purple_Sky from '@/assets/luts/04_Color/Purple_Sky.jpg'
import Red from '@/assets/luts/04_Color/Red.jpg'
import Skin from '@/assets/luts/04_Color/Skin.jpg'
import Dark_Contrast from '@/assets/luts/05_Dark/Dark_Contrast.jpg'
import Doomsday from '@/assets/luts/05_Dark/Doomsday.jpg'
import Green_and_Purple from '@/assets/luts/05_Dark/Green_and_Purple.jpg'
import Late_Sunset from '@/assets/luts/05_Dark/Late_Sunset.jpg'
import Moonlight from '@/assets/luts/05_Dark/Moonlight.jpg'
import Retro_Warm from '@/assets/luts/05_Dark/Retro_Warm.jpg'
import Cartoon from '@/assets/luts/06_Crushed/Cartoon.jpg'
import Gameboy_Color from '@/assets/luts/06_Crushed/Gameboy_Color.jpg'
import Ice from '@/assets/luts/06_Crushed/Ice.jpg'
import Neon from '@/assets/luts/06_Crushed/Neon.jpg'
import Toon_Burnt from '@/assets/luts/06_Crushed/Toon_Burnt.jpg'
import Toon_Goblin from '@/assets/luts/06_Crushed/Toon_Goblin.jpg'
import Toon_Pale from '@/assets/luts/06_Crushed/Toon_Pale.jpg'
import Toon_Punchy from '@/assets/luts/06_Crushed/Toon_Punchy.jpg'
import Toon_Shadow from '@/assets/luts/06_Crushed/Toon_Shadow.jpg'
import Toon_Sketch from '@/assets/luts/06_Crushed/Toon_Sketch.jpg'
import Violent_Violet from '@/assets/luts/06_Crushed/Violent_Violet.jpg'
import { AssetType, type Effect } from '@/types'
import { EffectOpType } from 'renderer/constants'

export const getDefaultFilters = (assetsPath?: string): Effect[] => {
  const rebaseAssetUrl = (path: string) =>
    assetsPath ? new URL(path, new URL(assetsPath, location.href)).href : path

  return [
    {
      name: 'TEST',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.8, 0.65] },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Crispy_Cyan), type: AssetType.HaldLut },
          intensity: 1.0,
        },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Goblin), type: AssetType.HaldLut },
          intensity: 1.0,
        },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Skin), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    // SORT IN
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
      name: 'Black',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.9, -1] },
        // { type: EffectOpType.FILM_GRAIN, intensity: 0.5 },
        { type: EffectOpType.VIGNETTE, intensity: 0.2 },
      ],
    },
    {
      name: 'Black Soft',
      ops: [
        { type: EffectOpType.ADJUST_COLOR, args: [0, 0.65, -1] },
        // { type: EffectOpType.FILM_GRAIN, intensity: 0.5 },
        { type: EffectOpType.VIGNETTE, intensity: 0.2 },
      ],
    },

    // ### C1 Warm ###
    {
      name: 'Fall',
      ops: [
        { type: EffectOpType.VIGNETTE, intensity: 0.3 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Fall), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Muted Warm',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Muted_Warm), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Beige',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Beige), type: AssetType.HaldLut },
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
      name: 'Romantic',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Romantic), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    // ### C2 Bright ###
    {
      name: 'Bleach',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Bleach), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Bleach Blue',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Bleach_Blue), type: AssetType.HaldLut },
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
    // ### C3 Cyan ###
    {
      name: 'Bright Cyan',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Bright_Cyan), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Crispy Cyan',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Crispy_Cyan), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    // ### C4 Color ###
    {
      name: 'Green → Red',
      ops: [
        { type: EffectOpType.VIGNETTE, intensity: 0.25 },
        { type: EffectOpType.LUT, lut: rebaseAssetUrl(Green_to_Red), intensity: 0.75 },
      ],
    },
    {
      name: 'Blue → Yellow',
      ops: [{ type: EffectOpType.LUT, lut: rebaseAssetUrl(Blue_to_Yellow) }],
    },
    {
      name: 'Purple Sky',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Purple_Sky), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Orange Cyan',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Orange_Cyan), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Red',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Red), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Pink',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Pink), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Purple Dream',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Purple_Dreams), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Puple Please',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Purple_Please), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Bruce Banner',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Bruce_Banner), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Skin',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Skin), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Metallic',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Metallic), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    // ### C5 Dark ###
    {
      name: 'Dark Contrast',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Dark_Contrast), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Green & Purple',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Green_and_Purple), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Retro Warm',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Retro_Warm), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Doomsday',
      ops: [
        // { type: EffectOpType.FILM_GRAIN, intensity:4 },
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Doomsday), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Late Sunset',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Late_Sunset), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Moonlight',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Moonlight), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    // ### C6 Crushed ###
    {
      name: 'Cartoon',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Cartoon), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Violent Violet',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Violent_Violet), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Neon',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Neon), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Ice',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Ice), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Burnt',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Burnt), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Pale',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Pale), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Sketch',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Sketch), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Shadow',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Shadow), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Punchy',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Punchy), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'Toon Goblin',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Toon_Goblin), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
    {
      name: 'GB Color',
      ops: [
        {
          type: EffectOpType.LUT,
          lut: { source: rebaseAssetUrl(Gameboy_Color), type: AssetType.HaldLut },
          intensity: 1.0,
        },
      ],
    },
  ]
}
