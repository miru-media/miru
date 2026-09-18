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
  translateX: number
  translateY: number
  rotate: number
  scaleX: number
  scaleY: number
}

export type FontStyle = 'normal' | 'italic' | 'oblique'
export type TextAlign = 'left' | 'center' | 'right' | 'justify'

export interface NodeRef {
  nodeId: string
}
type AssetRef = Pick<AnyAsset, 'id' | 'type'>

export type Linkable = AnyTrack | AnyClip
export interface NodeLink {
  id: string
  nodes: Pick<Linkable, 'id' | 'type'>[]
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
  thumbnailUri?: string
}

export interface BaseFileAsset<T extends string = string> extends BaseAsset<T> {
  mimeType: string
  size: number
  uri?: string
}

export interface MediaAsset extends BaseFileAsset<'media:av'> {
  duration: number
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
}

export interface ImageAsset extends BaseFileAsset<'media:image'> {
  mimeType: string
  width: number
  height: number
  rotation: number
}

export interface VideoEffectAsset extends BaseAsset<'effect:video'>, EffectDefinition {
  id: string
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
  'asset:media:image': ImageAsset
  'asset:effect:video': VideoEffectAsset
  'asset:font': FontAsset
}

export type AnyAsset = AssetSchemasByType[keyof AssetSchemasByType]

export interface VideoTrack extends Base {
  type: 'track:video'
}

export interface AudioTrack extends Base {
  type: 'track:audio'
}

export interface TrackChild extends Base {
  duration: Rational
}

export interface MediaAssetPlaceholderRef {
  id?: undefined
}

export interface BaseClip extends TrackChild {
  type: `clip:${string}`
  sourceStart: Rational
  mediaRef?: AssetRef | MediaAssetPlaceholderRef
  transition?: { assetId: string; duration: Rational }
}

export interface VideoClip extends BaseClip, Partial<TransformProps> {
  type: 'clip:video'
}

export interface AudioClip extends BaseClip {
  type: 'clip:audio'
  volume?: number
}

export interface ImageClip extends BaseClip, Partial<TransformProps> {
  type: 'clip:image'
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
  children: (SerializedVideoTrack | SerializedAudioTrack)[]
}

export interface SerializedVideoTrack extends VideoTrack {
  children: AnySerializedVideoClip[]
}
export interface SerializedAudioTrack extends AudioTrack {
  children: SerializedAudioClip[]
}
export type AnySerializedTrack = SerializedVideoTrack | SerializedAudioTrack

export type SerializedVideoClip = WithGap<VideoClip>
export type SerializedAudioClip = WithGap<AudioClip>
export type SerializedImageClip = WithGap<ImageClip>
export type SerializedTextClip = WithGap<TextClip>
export type AnySerializedClip = SerializedNodeSchemasByType[Extract<
  keyof NodeSchemasByType,
  `clip:${string}`
>]

type WithGap<T> = T & { gap?: Rational }

export interface NodeSchemasByType {
  timeline: Timeline
  'track:video': VideoTrack
  'track:audio': AudioTrack
  'clip:video': VideoClip
  'clip:audio': AudioClip
  'clip:image': ImageClip
  'clip:text': TextClip
}

export interface SerializedNodeSchemasByType {
  timeline: SerializedTimeline
  'track:video': SerializedVideoTrack
  'track:audio': SerializedAudioTrack
  'clip:video': SerializedVideoClip
  'clip:audio': SerializedAudioClip
  'clip:image': SerializedImageClip
  'clip:text': SerializedTextClip
}

export type AnyTrack = VideoTrack | AudioTrack
export type AnyNode = NodeSchemasByType[keyof NodeSchemasByType]
export type AnyClip = NodeSchemasByType[Extract<keyof NodeSchemasByType, `clip:${string}`>]
export type AnyMediaClip = VideoClip | AudioClip
export type AnyVideoClip = VideoClip | TextClip | ImageClip
export type AnyAudioClip = AudioClip

export type AnySerializedNode = SerializedNodeSchemasByType[keyof SerializedNodeSchemasByType]
export type AnySerializedVideoClip = Extract<AnySerializedNode, AnyVideoClip>

export interface SerializedDocument extends DocumentSettings {
  assets: AnyAsset[]
  timeline: SerializedTimeline
  links: NodeLink[]
}
