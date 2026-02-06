import type { EffectDefinition } from 'webgl-effects'

interface Base {
  id: string
  type: string
  name?: string
}

export interface Movie extends Base {
  type: 'movie'
  resolution: {
    width: number
    height: number
  }
  frameRate: number
}

export type CollectionKind = 'asset-library' | 'timeline'

export interface Collection<T extends CollectionKind = CollectionKind> extends Base {
  type: 'collection'
  kind: T
}

export interface AssetBase<T extends string> extends Base {
  type: `asset:${T}`
}

export interface AvMediaAsset extends AssetBase<'media:av'> {
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

export interface VideoEffectAsset extends AssetBase<'effect:video'>, Omit<EffectDefinition, 'id' | 'name'> {
  name: string
}

export type Asset = AvMediaAsset | VideoEffectAsset

export interface Track extends Base {
  type: 'track'
  trackType: 'audio' | 'video'
}

export interface Clip extends Base {
  type: 'clip'
  sourceStart: number
  duration: number
  source: { assetId: string }
  filter?: { assetId: string; intensity: number }
  transition?: { type: string }
}

export interface SerializedTrack extends Track {
  children: Clip[]
}

export interface SerializedMovie extends Movie {
  assets: (AvMediaAsset | VideoEffectAsset)[]
  tracks: SerializedTrack[]
}

export type AnyNodeSchema = Movie | Collection | Track | Clip | AvMediaAsset | VideoEffectAsset
export type AnyNodeSerializedSchema =
  | SerializedMovie
  | SerializedTrack
  | Clip
  | AvMediaAsset
  | VideoEffectAsset
