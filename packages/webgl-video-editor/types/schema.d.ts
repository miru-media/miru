import type { EffectDefinition } from 'webgl-effects'

export interface Point {
  x: number
  y: number
}

export interface Rational {
  value: number
  rate: number
}

export interface TransformProps {
  translate: Point
  rotate: number
  scale: Point
}

export type FontStyle = 'normal' | 'italic' | 'oblique'
export type TextAlign = 'left' | 'center' | 'right' | 'justify'

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
  thumbnailUri?: string
}

export interface VideoEffectAsset extends BaseAsset<'effect:video'>, Omit<EffectDefinition, 'id' | 'name'> {
  name: string
}

export interface FontAsset extends BaseAsset<'font'> {
  name: string
  family: string
  weight?: number
  style?: string
}

export interface AssetSchemasByType {
  'asset:media:av': MediaAsset
  'asset:effect:video': VideoEffectAsset
  'asset:font': FontAsset
}

export type AnyAssetSchema = AssetSchemasByType[keyof AssetSchemasByType]

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

export interface MediaAssetPlaceholderRef {
  assetId?: undefined
}

export interface BaseClip extends TrackChild {
  type: `clip:${string}`
  sourceStart: Rational
  mediaRef?: MediaAssetRef | MediaAssetPlaceholderRef
  transition?: { assetId: string; duration: Rational }
}

export interface VideoClip extends BaseClip, Partial<TransformProps> {
  type: 'clip:video'
}

export interface AudioClip extends BaseClip {
  type: 'clip:audio'
  volume?: number
}

export interface TextClip extends BaseClip, Partial<TransformProps> {
  type: 'clip:text'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight?: number
  fontStyle?: FontStyle
  align?: TextAlign
  inlineSize: number
  fill?: string
  stroke?: string
}

export interface SerializedTimeline extends Timeline {
  children: SerializedTrack[]
}

export interface SerializedTrack extends Track {
  children: AnySerializedClip[]
}

export type SerializedVideoClip = WithGap<VideoClip>
export type SerializedAudioClip = WithGap<AudioClip>
export type SerializedTextClip = WithGap<TextClip>
export type AnySerializedClip = WithGap<AnyClip>

type WithGap<T> = T & { gap?: Rational }

export interface NodeSchemasByType {
  timeline: Timeline
  track: Track
  'clip:video': VideoClip
  'clip:audio': AudioClip
  'clip:text': TextClip
}

export interface SerializedNodeSchemasByType {
  timeline: SerializedTimeline
  track: SerializedTrack
  'clip:video': SerializedVideoClip
  'clip:audio': SerializedAudioClip
  'clip:text': SerializedTextClip
}

export type AnyNode = NodeSchemasByType[keyof NodeSchemasByType]
export type AnyClip = NodeSchemasByType[Extract<keyof NodeSchemasByType, `clip:${string}`>]
export type AnyMediaClip = VideoClip | AudioClip
export type AnyVideoClip = VideoClip | TextClip
export type AnySerializedNode = SerializedNodeSchemasByType[keyof SerializedNodeSchemasByType]

export interface SerializedDocument extends DocumentSettings {
  assets: AnyAssetSchema[]
  timeline: SerializedTimeline
}
