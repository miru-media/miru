import type { EffectDefinition } from 'webgl-effects'

interface Base {
  id: string
  type: string
  name?: string
  enabled?: boolean
  effects?: { id: string; assetId: string; intensity: number }[]
  markers?: never[]
  color?: string
  metadata?: Record<string, unknown>
}

interface DocumentSettings {
  /** The width and height of the video */
  resolution: {
    width: number
    height: number
  }
  /** The frames per second of the video */
  frameRate: number
}

export interface Timeline extends Base {
  id: 'timeline'
  type: 'timeline'
}

export interface BaseAsset<T extends string> {
  id: string
  type: `asset:${T}`
  name?: string
  color?: string
  metadata?: Record<string, unknown>
}

export interface MediaAsset extends BaseAsset<'media:av'> {
  mimeType: string
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
  uri?: string
}

export interface VideoEffectAsset extends BaseAsset<'effect:video'>, Omit<EffectDefinition, 'id' | 'name'> {
  name: string
}

export type AnyAssetSchema = MediaAsset | VideoEffectAsset

export interface Track extends Base {
  type: 'track'
  trackType: 'audio' | 'video'
}

export interface TrackChild extends Base {
  duration: number
}

export interface MediaAssetRef {
  assetId: string
}

export interface VideoPlaceholderRef {
  assetId?: undefined
}

export interface AudioPlaceholderRef {
  assetId?: undefined
}

export interface BaseClip<
  T extends 'audio' | 'video' = 'audio' | 'video',
  TPlaceholder extends VideoPlaceholderRef | AudioPlaceholderRef = any,
> extends TrackChild {
  type: 'clip'
  clipType: T
  sourceStart: number
  mediaRef?: MediaAssetRef | TPlaceholder
  transition?: { assetId: string; duration: number }
}

export interface VideoClip extends BaseClip<'video', VideoPlaceholderRef> {
  position?: { x: number; y: number }
  rotation?: number
  scale?: { x: number; y: number }
}

export interface AudioClip extends BaseClip<'audio', AudioPlaceholderRef> {
  volume?: number
}

export type AnyClip = VideoClip | AudioClip

export interface Gap extends TrackChild {
  type: 'gap'
}

export interface SerializedTimeline extends Timeline {
  children: SerializedTrack[]
}

export interface SerializedTrack extends Track {
  children: (SerializedClip | SerializedGap)[]
}

export type SerializedClip = VideoClip | AudioClip
export type SerializedGap = Gap

export type AnyNode = Timeline | Track | AnyClip | Gap
export type AnyNodeSerializedSchema = SerializedTimeline | SerializedTrack | SerializedClip | SerializedGap

export interface SerializedDocument extends DocumentSettings {
  assets: (MediaAsset | VideoEffectAsset)[]
  tracks: SerializedTrack[]
}
