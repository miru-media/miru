/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging -- -- */
import type { Ref } from 'fine-jsx'
import type { EffectDefinition, Renderer } from 'webgl-effects'

import type { AssetBin } from '../src/constants.ts'
import type { VideoEditor as VideoEditorInternal } from '../src/video-editor.ts'

import type {
  AssetCreateEvent,
  AssetDeleteEvent,
  CanvasEvent,
  ErrorEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  PlaybackPauseEvent,
  PlaybackPlayEvent,
  PlaybackSeekEvent,
  PlaybackUpdateEvent,
  SettingsUpdateEvent,
} from './events.d.ts'
import type * as Schema from './schema.d.ts'
export * from './events.d.ts'

export type { Schema }

export interface ChildNodePosition {
  parentId: string
  index: number
}

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

export interface ClipTimeRational {
  start: Rational
  source: Rational
  duration: Rational
  end: Rational
}

export interface VideoEditorEvents {
  error: ErrorEvent

  'doc:dispose': DocDisposeEvent
  'settings:update': SettingsUpdateEvent

  'node:create': NodeCreateEvent
  'node:move': NodeMoveEvent
  'node:update': NodeUpdateEvent
  'node:delete': NodeDeleteEvent

  'asset:create': AssetCreateEvent
  'asset:delete': AssetDeleteEvent

  'playback:play': PlaybackPlayEvent
  'playback:pause': PlaybackPauseEvent
  'playback:update': PlaybackUpdateEvent
  'playback:seek': PlaybackSeekEvent

  'canvas:click': CanvasEvent<'click'>
  'canvas:pointerdown': CanvasEvent<'pointerdown'>
  'canvas:pointermove': CanvasEvent<'pointermove'>
  'canvas:pointerup': CanvasEvent<'pointerup'>
}

export type AssetEventType = Extract<keyof VideoEditorEvents, `asset:${string}`>

export interface Document extends Schema.DocumentSettings {
  readonly currentTime: number
  readonly duration: number
  readonly timeline: Timeline
  readonly assets: VideoEditorAssetStore
  readonly nodes: NodeMap
  /** True if the video has no clips */
  readonly isEmpty: boolean

  isDisposed: boolean

  /** @internal */
  activeClipIsStalled: Ref<boolean>

  createNode: <T extends Schema.AnyNode>(init: T) => NodesByType[T['type']]

  /**
   * Seek to the given time of the video.
   *
   * @param time The seek time in seconds.
   */
  seekTo: (time: number) => void
  _setCurrentTime: (time: number) => void
  importFromJson: (content: Schema.SerializedDocument) => void
  toJSON: () => Schema.SerializedDocument
  on: <T extends Extract<keyof VideoEditorEvents, string>>(
    type: T,
    listener: (event: VideoEditorEvents[T]) => unknown,
    options?: AddEventListenerOptions,
  ) => () => void
  emit: (event: VideoEditorEvents[keyof VideoEditorEvents]) => void

  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface NodeMap {
  get: <T extends AnyNode>(id: string) => T
  set: (node: AnyNode) => void
  has: (id: string) => boolean
  delete: (id: string) => boolean
  forEach: (fn: (node: AnyNode) => unknown) => void
}

export interface BaseNode extends Omit<Schema.Base, 'type' | 'effects'> {
  readonly doc: Document
  readonly parent?: AnyParentNode
  readonly index: number
  prev?: AnyNode
  next?: AnyNode
  enabled: boolean
  effects: NonNullable<Schema.Base['effects']>
  isDisposed: boolean
  move: (position: ChildNodePosition | undefined) => void
  remove: () => void
  isTimeline: () => this is Timeline
  isTrack: () => this is Track
  isTrackChild: () => this is AnyTrackChild
  isClip: () => this is AnyClip
  isMediaClip: () => this is AnyMediaClip
  isTextClip: () => this is TextClip
  isGap: () => this is Gap
  isVideo: () => this is AnyVideoNode
  isAudio: () => this is AnyAudioNode
  toJSON: () => any
  delete: () => void
  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface ParentNode<TChild extends AnyNode> extends BaseNode {
  readonly head?: TChild
  readonly tail?: TChild
  readonly children: TChild[]
  /** @internal */
  _unlinkChild: (node: TChild) => void
  /** @internal */
  _positionChildAt: (node: TChild, index: number) => void
}

export interface Timeline extends ParentNode<Track>, Schema.Timeline {
  readonly parent?: undefined
  readonly trackCount: number
  toJSON: () => Schema.Timeline
}

type TrackType = 'video' | 'audio'

export interface Track extends ParentNode<AnyTrackChild>, Schema.Track {
  readonly trackType: TrackType
  readonly parent?: Timeline
  readonly firstClip?: AnyClip
  readonly lastClip?: AnyClip
  readonly clips: AnyClip[]
  readonly clipCount: number
  readonly duration: Rational
  prev?: Track
  next?: Track
  toJSON: () => Schema.Track
}

export interface TrackChild extends BaseNode {
  duration: Rational
  readonly timeRational: ClipTimeRational
  readonly time: ClipTime
  readonly parent?: Track
  prev?: AnyTrackChild | undefined
  next?: AnyTrackChild | undefined
  readonly prevClip?: AnyClip | undefined
  readonly nextClip?: AnyClip | undefined
}

export interface Clip<T extends Schema.BaseClip> extends TrackChild, Schema.BaseClip {
  type: T['type']
  name: string
  sourceStart: Rational
  readonly isReady: boolean
  readonly asset: MediaAsset | undefined
  readonly playableTime: ClipTime
  readonly presentationTime: ClipTime
  readonly expectedMediaTime: number
  readonly isInClipTime: boolean
}

export interface VideoClip
  extends Clip<Schema.VideoClip>, Omit<Schema.VideoClip, keyof Schema.TransformProps>, Schema.TransformProps {
  effects: NonNullable<Schema.VideoClip['effects']>
  toJSON: () => Schema.VideoClip
}
export interface AudioClip extends Clip<Schema.AudioClip>, Schema.AudioClip {
  volume: number
  toJSON: () => Schema.AudioClip
}
export interface TextClip
  extends Clip<Schema.TextClip>, Omit<Schema.TextClip, keyof Schema.TransformProps>, Schema.TransformProps {
  fontWeight: number
  fontStyle: Schema.FontStyle
  toJSON: () => Schema.TextClip
}

export interface Gap extends TrackChild, Schema.Gap {
  toJSON: () => Schema.Gap
}

export interface NodesByType {
  timeline: Timeline
  track: Track
  'clip:video': VideoClip
  'clip:audio': AudioClip
  'clip:text': TextClip
  gap: Gap
}

export type AnyNode = NodesByType[keyof NodesByType]
export type AnyClip = NodesByType[Extract<keyof NodesByType, `clip:${string}`>]
export type AnyMediaClip = VideoClip | AudioClip
export type AnyVideoClip = VideoClip | TextClip
export type AnyTrackChild = AnyClip | Gap
export type AnyParentNode = Timeline | Track
export type AnyVideoNode = Timeline | Track | VideoClip | TextClip
export type AnyAudioNode = Timeline | Track | AudioClip

interface BaseAsset extends Schema.BaseAsset {
  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface MediaAsset extends BaseAsset, Readonly<Schema.MediaAsset> {
  readonly blob?: Blob
  readonly blobUrl?: string
  readonly isLoading: boolean
  uri?: string
  setBlob: (blob: Blob | undefined) => void
  setError: (error: unknown) => void
  toJSON: () => Schema.MediaAsset
  /** @internal */
  _refreshObjectUrl: () => Promise<void>
}

export interface VideoEffectAsset extends BaseAsset, Readonly<Schema.VideoEffectAsset> {
  readonly raw: EffectDefinition
  toJSON: () => Schema.VideoEffectAsset
}

export interface FontAsset extends BaseAsset, Schema.FontAsset {
  toJSON: () => Schema.FontAsset
}

export interface AssetsByType {
  'asset:media:av': MediaAsset
  'asset:effect:video': VideoEffectAsset
  'asset:font': FontAsset
}

export type AnyAsset = AssetsByType[keyof AssetsByType]

export type { AssetOrigin } from './schema.d.ts'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- false positive
export class VideoEditor {
  constructor(options?: { sync?: pub.VideoEditorStore; assets?: pub.VideoEditorAssetStore })
}

export interface VideoEditor {
  /** @internal */
  _editor: VideoEditorInternal

  doc: Document
  sync?: VideoEditorDocumentSync

  /** The canvas that the video is rendered to */
  canvas: HTMLCanvasElement

  /** The current playback time of the video timeline */
  currentTime: number

  /** The webgl-effects that are loaded into the editor */
  effects: Map<string, VideoEffectAsset>

  /** The currently selected video clip on the timeline. */
  selection?: AnyClip | Gap

  /** The audio and video tracks which contain clips */
  tracks: Track[]

  /** The state of the asset bin ui */
  activeAssetBin: AssetBin

  /** The webgl-effects Renderer instance */
  readonly effectRenderer: Renderer

  /** Progress from 0 to 1 while exporting */
  readonly exportProgress: number

  readonly viewportSize: { width: number; height: number }

  readonly zoom: number

  playback: {
    /** Playback is paused */
    readonly isPaused: boolean

    readonly isReady: boolean

    /** Play the video at the current time or from the start if the video is ended. */
    play: () => void

    /** Play the video. */
    pause: () => void

    /** @internal */
    stats: any
  }

  /** @internal */
  readonly _secondsPerPixel: { value: number }
  /** @internal */

  secondsToPixels: (seconds: number) => number
  pixelsToSeconds: (pixels: number) => number

  /** Select the given track item */
  select: (clip: AnyTrackChild | undefined) => void

  /**
   * Seek to the given time of the video.
   *
   * @param time The seek time in seconds.
   */
  seekTo: (time: number) => void

  /**
   * Add a new track to the timeline.
   *
   * @param trackType The track the clip will be added to.
   */
  addTrack: (trackType: Track['trackType']) => Track

  /**
   * Add a new clip at the end of the specified track.
   *
   * @param track The track the clip will be added to.
   * @param asset The media asset attached to the clip.
   */
  addClip: (track: Track, asset: MediaAsset) => AnyClip

  /** Change the media of the selected clip */
  replaceClipAsset: (asset: MediaAsset) => void

  /**
   * Create a new media asset with the given source File or URI
   *
   * @param source A Blob or URI string of the clip media.
   */
  createMediaAsset: (source: Blob | string) => Promise<MediaAsset>

  /**
   * Split a clip that intersects with the current video time. If a clip is selected, its track will be
   * searched for an intersecting clip. If a clip isn't found, all tracks are then searched in order. When a
   * clip is found, its duration is reduced and a similar clip is inserted after it.
   *
   * @returns The newly created clip or `undefined.`.
   */
  splitClipAtCurrentTime: () => [AnyClip, AnyClip] | undefined

  /** Delete the selected clip */
  deleteSelection: () => void

  generateId: () => string

  /** Adds assets and tracks from the provided JSON object */
  importJson: (newContent: Schema.SerializedDocument) => void

  /**
   * Render and encode the video composition.
   *
   * @returns A promise that resolves to an object with a `blob` field and a "blob:" `url` field to the
   *   resulting video file.
   */
  export: () => Promise<{ blob: Blob; url: string } | undefined>
  /** The most recent export result. */
  exportResult: { blob: Blob; url: string } | undefined

  /** Release resources of the video editor and allow it to be garbage collected. */
  dispose: () => void
  [Symbol.dispose]: () => void
}

export type VideoEditorChangeEvent = CustomEvent<Schema.SerializedDocument>
export type VideoEditorChangeLoadingEvent = CustomEvent<boolean>

export interface VideoEditorDocumentSync {
  doc: Document

  /** The editor has a change that can be undone */
  canUndo: boolean
  /** A change was undone and can be reapplied */
  canRedo: boolean

  /** Generate A unique ID */
  generateId: () => string

  /** Undo the last editor action. */
  undo: () => void
  /** Redo the last editor action. */
  redo: () => void

  transact: <T>(fn: () => T) => T

  /** Clear undo hsitory */
  reset: () => void
}

export interface VideoEditorAssetStore {
  values: () => Iterable<AnyAsset>
  has: (id: string) => boolean

  create: <T extends Schema.AnyAssetSchema['type']>(
    init: Extract<Schema.AnyAssetSchema, { type: T }>,
    options?: { source?: Blob | string },
  ) => AssetsByType[T]

  getAsset: <T extends AnyAsset | undefined>(id: string) => T

  /** Save a new file from an asset source stream */
  createFile: (
    asset: MediaAsset,
    stream: ReadableStream<Uint8Array>,
    options: {
      size?: number
      onProgress?: (progress: number) => void
      signal?: AbortSignal | null
    },
  ) => Promise<void>

  /** Get an asset as a File instance */
  getFile: (key: string, name?: string, options?: FilePropertyBag) => Promise<File>

  getOrCreateFile: (
    asset: MediaAsset,
    source: Blob | string | undefined,
    requestInit?: { signal?: AbortSignal | null },
  ) => Promise<File>

  /** Delete an asset form the store */
  delete: (key: string) => Promise<void>

  createMediaAsset: (source: Blob | string) => Promise<MediaAsset>

  loaders: AssetLoader[]

  on: <T extends AssetEventType>(
    type: T,
    listener: (event: VideoEditorEvents[T]) => void,
    options?: AddEventListenerOptions,
  ) => () => void

  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface AssetLoader {
  canLoad: (asset: Schema.MediaAsset) => boolean
  load: (
    asset: Schema.MediaAsset,
    options?: { signal?: AbortSignal | null },
  ) => Promise<{ stream: ReadableStream<Uint8Array>; size?: number }>
}

export interface Rational {
  value: number
  rate: number

  add: (other: RationalLike) => Rational
  subtract: (other: RationalLike) => Rational
  toRate: (rate: number) => Rational
  compare: (other: RationalLike) => number
  isLessThan: (other: RationalLike) => boolean
  isGreaterThan: (other: RationalLike) => boolean
  isEqualTo: (other: RationalLike) => boolean
  isLte: (other: RationalLike) => boolean
  isGte: (other: RationalLike) => boolean
  clamp: (min: RationalLike, max: RationalLike) => Rational
  valueOf: () => number
  toJSON: () => { value: number; rate: number }
  toOTIO: () => { OTIO_SCHEMA: 'RationalTime.1'; rate: number; value: number }
}
