import { EffectOpType } from '@/constants'

export type SyncImageSource =
  | HTMLImageElement
  | HTMLVideoElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageData
  | ImageBitmap
export type AsyncImageSource = Blob | string
export type ImageSource = SyncImageSource | AsyncImageSource
export type CrossOrigin = 'anonymous' | 'use-credentials' | null

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface Size {
  width: number
  height: number
}

export interface Tlwh {
  top: number
  left: number
  width: number
  height: number
}

export interface Xywh {
  x: number
  y: number
  width: number
  height: number
}

export interface CropState {
  x: number
  y: number
  width: number
  height: number
  rotate: number
}

export interface AdjustmentsState {
  brightness: number
  contrast: number
  saturation: number
}

export interface ImageEditState {
  effect: number
  intensity: number
  crop?: CropState
  adjustments?: AdjustmentsState
}

export interface ImageSourceObject {
  source: ImageSource
  crossOrigin?: CrossOrigin
  isLut?: boolean
  isHald?: boolean
}
export type ImageSourceOption = ImageSource | ImageSourceObject

export type EffectOpType = number

export interface RendererEffect {
  images: WebGLTexture[]
  luts: WebGLTexture[]
  ops: RendererEffectOp[]
}

export interface RendererEffectOp {
  type: EffectOpType
  image: number
  lut: number
  args?: number[]
  intensity: [from: number, to: number]
}

export interface Effect {
  name: string
  ops: {
    type: EffectOpType
    image?: ImageSourceOption
    lut?: ImageSourceOption
    args?: number[]
    intensity?: [from: number, to: number]
  }[]
}

export const enum EditorView {
  Filter = 'filter',
  Adjust = 'adjust',
  Crop = 'crop',
}

export type MaybeArray<T> = T | T[]

export type InputEvent = Event & { target: HTMLInputElement }
