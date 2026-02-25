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

export interface Timeline extends Base {
  type: 'timeline'
}

export interface BaseAsset<T extends string> {
  id: string
  type: `asset:${T}`
  name?: string
}

export interface AvMediaAsset extends BaseAsset<'media:av'> {
  mimeType: string
  url?: string
  duration: number
  size: number
  audio?: {
    codec: string
    duration: number
    numberOfChannels: number
    sampleRate: number
    firstTimestamp: number
  }
  video?: {
    codec: string
    duration: number
    rotation: number
    width: number
    height: number
    frameRate: number
    firstTimestamp: number
  }
}

export interface VideoEffectAsset extends BaseAsset<'effect:video'>, Omit<EffectDefinition, 'id' | 'name'> {
  name: string
}

export type AnyAsset = AvMediaAsset | VideoEffectAsset

export interface Track extends Base {
  type: 'track'
  trackType: 'audio' | 'video'
}

export interface TrackChild extends Base {
  duration: number
}

export interface BaseClip<T extends 'audio' | 'video' = 'audio' | 'video'> extends TrackChild {
  type: 'clip'
  clipType: T
  sourceStart: number
  source: { assetId: string }
  transition?: { type: string }
}

export interface VisualClip extends BaseClip<'video'> {
  position?: { x: number; y: number }
  rotation?: number
  scale?: { x: number; y: number }
  filter?: { assetId: string; intensity: number }
  videoRotation?: number
}

export interface AudioClip extends BaseClip<'audio'> {
  volume?: number
  mute?: boolean
}

export type AnyClip = VisualClip | AudioClip

export interface Gap extends TrackChild {
  type: 'gap'
}

export interface SerializedTrack extends Track {
  children: (SerializedClip | SerializedGap)[]
}

export interface SerializedMovie extends Movie {
  assets: (AvMediaAsset | VideoEffectAsset)[]
  tracks: SerializedTrack[]
}

export interface SerializedTimeline extends Timeline {
  children: SerializedTrack[]
}

export type SerializedClip = VisualClip | AudioClip
export type SerializedGap = Gap

export type AnyNodeSchema = Movie | Timeline | Track | AnyClip | Gap
export type AnyNodeSerializedSchema =
  | SerializedMovie
  | SerializedTimeline
  | SerializedTrack
  | SerializedClip
  | SerializedGap
