import type * as twgl from 'twgl.js'

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
  programInfo: twgl.ProgramInfo
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

  export interface ChromaticAbberation {
    type: 'chromatic_aberration'
    red: number
    blue: number
    green: number
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
  | EffectOp.ChromaticAbberation

export interface EffectDefinition {
  id?: string
  name: string
  ops: EffectOp[]
}

export interface RendererOptions {
  gl?: WebGL2RenderingContext
  canvas?: HTMLCanvasElement | OffscreenCanvas
}

export interface RendererDrawOptions {
  framebuffer?: WebGLFramebuffer | null
  x?: number
  y?: number
  width?: number
  height?: number
  clear?: boolean
}

export interface CropState {
  x: number
  y: number
  width: number
  height: number
  rotate: number
}

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** An object with width and height number fields */
interface Size {
  width: number
  height: number
}

export interface ExportResult {
  blob: Blob
  url: string
}
