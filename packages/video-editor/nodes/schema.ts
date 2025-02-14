import { type EffectDefinition } from 'webgl-effects'

import { type Size } from 'shared/types'

interface Base {
  id: string
  type: string
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

export interface VideoEffectAsse extends Base, Required<EffectDefinition> {
  type: 'video_effect_asset'
}

export type Asset = AvMediaAsset | VideoEffectAsse

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
