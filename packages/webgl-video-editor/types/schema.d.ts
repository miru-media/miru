import type { EffectDefinition } from 'webgl-effects'

export interface Rational {
  value: number
  rate: number
}

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
  metadata?: Record<string, unknown>
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
    duration: Rational
    numberOfChannels: number
    sampleRate: number
    firstTimestamp: Rational
  }
  video?: {
    codec: string
    duration: Rational
    rotation: number
    width: number
    height: number
    frameRate: number
    firstTimestamp: Rational
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
  duration: Rational
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
  TPlaceholder extends VideoPlaceholderRef | AudioPlaceholderRef = any,
> extends TrackChild {
  type: `clip:${string}`
  sourceStart: Rational
  mediaRef?: MediaAssetRef | TPlaceholder
  transition?: { assetId: string; duration: Rational }
}

export interface VideoClip extends BaseClip<VideoPlaceholderRef> {
  type: 'clip:video'
  translate?: { x: number; y: number }
  rotate?: number
  scale?: { x: number; y: number }
}

export interface AudioClip extends BaseClip<AudioPlaceholderRef> {
  type: 'clip:audio'
  volume?: number
}

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

export interface NodeSchemasByType {
  timeline: Timeline
  track: Track
  'clip:video': VideoClip
  'clip:audio': AudioClip
  gap: Gap
}

export type AnyNode = NodeSchemasByType[keyof NodeSchemasByType]
export type AnyClip = NodeSchemasByType[Extract<keyof NodeSchemasByType, `clip:${string}`>]
export type AnyNodeSerializedSchema = SerializedTimeline | SerializedTrack | SerializedClip | SerializedGap

export interface SerializedDocument extends DocumentSettings {
  assets: (MediaAsset | VideoEffectAsset)[]
  timeline: SerializedTimeline
}
