import { type MaybeRefOrGetter } from 'fine-jsx'
import { type AssetType } from 'webgl-effects'

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
  effect: string | undefined
  intensity: number
  crop?: CropState
  adjustments?: AdjustmentsState
}

export interface ImageSourceObject {
  source: ImageSource
  crossOrigin?: CrossOrigin
  type: AssetType.Image | AssetType.Video | AssetType.Lut | AssetType.HaldLut
}
export type ImageSourceOption = ImageSource | ImageSourceObject

export const enum EditorView {
  Filter = 'filter',
  Adjust = 'adjust',
  Crop = 'crop',
}

export type MaybeArray<T> = T | T[]

export type InputEvent = Event & { target: HTMLInputElement }

export interface I18nOptions {
  messages: MaybeRefOrGetter<Record<string, Record<string, string>>>
  languages?: MaybeRefOrGetter<string[]>
}
