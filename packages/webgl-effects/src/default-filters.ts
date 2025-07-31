import Beige from 'shared/assets/luts/01_Warm/Beige.jpg'
import Fall from 'shared/assets/luts/01_Warm/Fall.jpg'
import Muted_Warm from 'shared/assets/luts/01_Warm/Muted_Warm.jpg'
import Pinky from 'shared/assets/luts/01_Warm/Pinky.jpg'
import Romantic from 'shared/assets/luts/01_Warm/Romantic.jpg'
import Bleach from 'shared/assets/luts/02_Bright/Bleach.jpg'
import Bleach_Blue from 'shared/assets/luts/02_Bright/Bleach_Blue.jpg'
import Stocky from 'shared/assets/luts/02_Bright/Stocky.jpg'
import Bright_Cyan from 'shared/assets/luts/03_Cyan/Bright_Cyan.jpg'
import Crispy_Cyan from 'shared/assets/luts/03_Cyan/Crispy_Cyan.jpg'
import Blue_to_Yellow from 'shared/assets/luts/04_Color/Blue_to_Yellow.jpg'
import Bruce_Banner from 'shared/assets/luts/04_Color/Bruce_Banner.jpg'
import Green_to_Red from 'shared/assets/luts/04_Color/Green_to_Red.jpg'
import Metallic from 'shared/assets/luts/04_Color/Metallic.jpg'
import Orange_Cyan from 'shared/assets/luts/04_Color/Orange_Cyan.jpg'
import Pink from 'shared/assets/luts/04_Color/Pink.jpg'
import Purple_Dreams from 'shared/assets/luts/04_Color/Purple_Dreams.jpg'
import Purple_Please from 'shared/assets/luts/04_Color/Purple_Please.jpg'
import Purple_Sky from 'shared/assets/luts/04_Color/Purple_Sky.jpg'
import Red from 'shared/assets/luts/04_Color/Red.jpg'
import Skin from 'shared/assets/luts/04_Color/Skin.jpg'
import Dark_Contrast from 'shared/assets/luts/05_Dark/Dark_Contrast.jpg'
import Doomsday from 'shared/assets/luts/05_Dark/Doomsday.jpg'
import Green_and_Purple from 'shared/assets/luts/05_Dark/Green_and_Purple.jpg'
import Late_Sunset from 'shared/assets/luts/05_Dark/Late_Sunset.jpg'
import Moonlight from 'shared/assets/luts/05_Dark/Moonlight.jpg'
import Retro_Warm from 'shared/assets/luts/05_Dark/Retro_Warm.jpg'
import Cartoon from 'shared/assets/luts/06_Crushed/Cartoon.jpg'
import Gameboy_Color from 'shared/assets/luts/06_Crushed/Gameboy_Color.jpg'
import Ice from 'shared/assets/luts/06_Crushed/Ice.jpg'
import Neon from 'shared/assets/luts/06_Crushed/Neon.jpg'
import Toon_Burnt from 'shared/assets/luts/06_Crushed/Toon_Burnt.jpg'
import Toon_Goblin from 'shared/assets/luts/06_Crushed/Toon_Goblin.jpg'
import Toon_Pale from 'shared/assets/luts/06_Crushed/Toon_Pale.jpg'
import Toon_Punchy from 'shared/assets/luts/06_Crushed/Toon_Punchy.jpg'
import Toon_Shadow from 'shared/assets/luts/06_Crushed/Toon_Shadow.jpg'
import Toon_Sketch from 'shared/assets/luts/06_Crushed/Toon_Sketch.jpg'
import Violent_Violet from 'shared/assets/luts/06_Crushed/Violent_Violet.jpg'

import type { EffectDefinition } from './types/core.ts'

export const getDefaultFilterDefinitions = (assetsPath?: string): EffectDefinition[] => {
  const rebaseAssetUrl = (path: string) =>
    assetsPath ? new URL(path, new URL(assetsPath, location.href)).href : path

  return [
    // SORT IN
    {
      id: 'Contrast',
      name: 'Contrast',
      ops: [{ type: 'adjust_color', brightness: 0, contrast: 0.65, saturation: 0 }],
    },
    {
      id: 'Vintage',
      name: 'Vintage',
      ops: [
        { type: 'sepia' },
        // { type: 'film_grain', intensity: 0.7 },
        { type: 'vignette', intensity: 0.5 },
      ],
    },
    {
      id: 'Black',
      name: 'Black',
      ops: [
        { type: 'adjust_color', brightness: 0, contrast: 0.9, saturation: -1 },
        // { type: 'film_grain', intensity: 0.5 },
        { type: 'vignette', intensity: 0.2 },
      ],
    },
    {
      id: 'Black Soft',
      name: 'Black Soft',
      ops: [
        { type: 'adjust_color', brightness: 0, contrast: 0.65, saturation: -1 },
        // { type: 'film_grain', intensity: 0.5 },
        { type: 'vignette', intensity: 0.2 },
      ],
    },
    {
      id: 'Chromatic',
      name: 'Chromatic',
      ops: [{ type: 'chromatic_aberration', red: 10, blue: -10, green: 0 }],
    },

    // ### C1 Warm ###
    {
      id: 'Fall',
      name: 'Fall',
      ops: [
        { type: 'vignette', intensity: 0.3 },
        { type: 'lut', lut: { source: rebaseAssetUrl(Fall), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Muted Warm',
      name: 'Muted Warm',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Muted_Warm), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Beige',
      name: 'Beige',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Beige), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Pinky',
      name: 'Pinky',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Pinky), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Romantic',
      name: 'Romantic',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Romantic), type: 'hald-lut' }, intensity: 1.0 }],
    },
    // ### C2 Bright ###
    {
      id: 'Bleach',
      name: 'Bleach',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Bleach), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Bleach Blue',
      name: 'Bleach Blue',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Bleach_Blue), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Stocky',
      name: 'Stocky',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Stocky), type: 'hald-lut' }, intensity: 1.0 }],
    },
    // ### C3 Cyan ###
    {
      id: 'Bright Cyan',
      name: 'Bright Cyan',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Bright_Cyan), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Crispy Cyan',
      name: 'Crispy Cyan',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Crispy_Cyan), type: 'hald-lut' }, intensity: 1.0 }],
    },
    // ### C4 Color ###
    {
      id: 'Green → Red',
      name: 'Green → Red',
      ops: [
        { type: 'vignette', intensity: 0.25 },
        { type: 'lut', lut: rebaseAssetUrl(Green_to_Red), intensity: 0.75 },
      ],
    },
    {
      id: 'Blue → Yellow',
      name: 'Blue → Yellow',
      ops: [{ type: 'lut', lut: rebaseAssetUrl(Blue_to_Yellow) }],
    },
    {
      id: 'Purple Sky',
      name: 'Purple Sky',
      ops: [
        // { type: 'film_grain', intensity:4 },
        { type: 'lut', lut: { source: rebaseAssetUrl(Purple_Sky), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Orange Cyan',
      name: 'Orange Cyan',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Orange_Cyan), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Red',
      name: 'Red',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Red), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Pink',
      name: 'Pink',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Pink), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Purple Dream',
      name: 'Purple Dream',
      ops: [
        { type: 'lut', lut: { source: rebaseAssetUrl(Purple_Dreams), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Puple Please',
      name: 'Puple Please',
      ops: [
        { type: 'lut', lut: { source: rebaseAssetUrl(Purple_Please), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Bruce Banner',
      name: 'Bruce Banner',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Bruce_Banner), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Skin',
      name: 'Skin',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Skin), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Metallic',
      name: 'Metallic',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Metallic), type: 'hald-lut' }, intensity: 1.0 }],
    },
    // ### C5 Dark ###
    {
      id: 'Dark Contrast',
      name: 'Dark Contrast',
      ops: [
        // { type: 'film_grain', intensity:4 },
        { type: 'lut', lut: { source: rebaseAssetUrl(Dark_Contrast), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Green & Purple',
      name: 'Green & Purple',
      ops: [
        // { type: 'film_grain', intensity:4 },
        { type: 'lut', lut: { source: rebaseAssetUrl(Green_and_Purple), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Retro Warm',
      name: 'Retro Warm',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Retro_Warm), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Doomsday',
      name: 'Doomsday',
      ops: [
        // { type: 'film_grain', intensity:4 },
        { type: 'lut', lut: { source: rebaseAssetUrl(Doomsday), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Late Sunset',
      name: 'Late Sunset',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Late_Sunset), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Moonlight',
      name: 'Moonlight',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Moonlight), type: 'hald-lut' }, intensity: 1.0 }],
    },
    // ### C6 Crushed ###
    {
      id: 'Cartoon',
      name: 'Cartoon',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Cartoon), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Violent Violet',
      name: 'Violent Violet',
      ops: [
        { type: 'lut', lut: { source: rebaseAssetUrl(Violent_Violet), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
    {
      id: 'Neon',
      name: 'Neon',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Neon), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Ice',
      name: 'Ice',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Ice), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Burnt',
      name: 'Toon Burnt',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Burnt), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Pale',
      name: 'Toon Pale',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Pale), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Sketch',
      name: 'Toon Sketch',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Sketch), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Shadow',
      name: 'Toon Shadow',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Shadow), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Punchy',
      name: 'Toon Punchy',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Punchy), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'Toon Goblin',
      name: 'Toon Goblin',
      ops: [{ type: 'lut', lut: { source: rebaseAssetUrl(Toon_Goblin), type: 'hald-lut' }, intensity: 1.0 }],
    },
    {
      id: 'GB Color',
      name: 'GB Color',
      ops: [
        { type: 'lut', lut: { source: rebaseAssetUrl(Gameboy_Color), type: 'hald-lut' }, intensity: 1.0 },
      ],
    },
  ]
}
