import type { EffectDefinition } from 'webgl-effects'

interface Size {
  width: number
  height: number
}

interface Base {
  id: string
  type: string
  name?: string
}

export interface Movie extends Base {
  type: 'movie'
  resolution: Size
  frameRate: number
  assets: Asset[]
  children: Track[]
}

export interface AvMediaAsset extends Base {
  type: 'av_media_asset'
  mimeType: string
  url?: string
  duration: number
  audio?: {
    duration: number
  }
  video?: {
    duration: number
    rotation: number
  }
}

export interface VideoEffectAsset extends Base, Omit<EffectDefinition, 'id' | 'name'> {
  type: 'video_effect_asset'
  name: string
}

export type Asset = AvMediaAsset | VideoEffectAsset

export interface Track extends Base {
  type: 'track'
  trackType: 'audio' | 'video'
  children: Clip[]
}

export interface Clip extends Base {
  type: 'clip'
  sourceStart: number
  duration: number
  source: { assetId: string }
  filter?: { assetId: string; intensity: number }
  transition?: { type: string }
}
