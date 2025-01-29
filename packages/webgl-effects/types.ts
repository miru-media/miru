import { type ProgramInfo } from 'twgl.js'

export namespace AssetType {
  export type Image = 'image'
  export type Video = 'video'
  export type Lut = 'lut'
  export type HaldLut = 'hald-lut'
}

export type AssetType = AssetType.Image | AssetType.Video | AssetType.Lut | AssetType.HaldLut

export interface RendererEffect {
  ops: RendererEffectOp[]
}

export interface RendererEffectOp {
  programInfo: ProgramInfo
  intensity: number
  uniforms: Record<string, number | ArrayLike<number> | WebGLTexture>
}

export namespace EffectOp {
  export interface Shader {
    type: 'shader'
    fragmentShader: string
    intensity?: number
    properties?: Record<string, number | ArrayLike<number> | { source: string; type: AssetType }>
  }

  export interface Lut {
    type: 'lut'
    intensity?: number
    lut: string | { source: string; type?: 'lut' | 'hald-lut' }
  }

  export interface Vignette {
    type: 'vignette'
    intensity?: number
  }

  export interface FilmGrain {
    type: 'film_grain'
    intensity?: number
  }

  export interface AdjustColor {
    type: 'adjust_color'
    brightness: number
    contrast: number
    saturation: number
    intensity?: number
  }

  export interface Sepia {
    type: 'sepia'
    intensity?: number
  }

  export interface HueRotate {
    type: 'hue_rotate'
    angle: number
    intensity?: number
  }
}

export type EffectOp =
  | EffectOp.Shader
  | EffectOp.Lut
  | EffectOp.Vignette
  | EffectOp.FilmGrain
  | EffectOp.AdjustColor
  | EffectOp.Sepia
  | EffectOp.HueRotate

export interface EffectDefinition {
  name: string
  ops: EffectOp[]
}
