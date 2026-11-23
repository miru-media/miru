import type { Ref } from 'fine-jsx'

import type { Animation } from './animation'
import type * as events from './events.d.ts'
import type * as Schema from './schema.d.ts'

export type * from './animation.d.ts'
export type * from './events.d.ts'
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

export interface NodeFieldFlags {
  ReactiveProp: number
  Readonly: number
  Node: number
  NodeArray: number
  Asset: number
  Gap: number
  Constant: number
  Animatable: number
  Color: number
  TransformProp: number
  TextStyleProp: number
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional
export interface NodeFieldDef<T extends {}, K extends Extract<keyof T, string> = Extract<keyof T, string>> {
  key: K
  flags: number
  defaultValue?: T[K]
  equal?: (a: any, b: any) => boolean
  transform?: (value: any) => T[K]
}

export interface VideoEditorEvents {
  error: events.ErrorEvent

  'doc:dispose': DocDisposeEvent
  'settings:update': events.SettingsUpdateEvent

  'node:create': events.NodeCreateEvent
  'node:move': events.NodeMoveEvent
  'node:update': events.NodeUpdateEvent
  'node:gap-update': events.NodeGapUpdateEvent
  'node:list-change': events.NodeListChangeEvent
  'node:delete': events.NodeDeleteEvent

  'asset:create': events.AssetCreateEvent
  'asset:delete': events.AssetDeleteEvent

  'link:create': events.LinkCreateEvent
  'link:update': events.LinkUpdateEvent
  'link:delete': events.LinkDeleteEvent

  'playback:play': events.PlaybackPlayEvent
  'playback:pause': events.PlaybackPauseEvent
  'playback:update': events.PlaybackUpdateEvent
  'playback:seek': events.PlaybackSeekEvent

  'canvas:click': events.CanvasEvent<'click'>
  'canvas:pointerdown': events.CanvasEvent<'pointerdown'>
  'canvas:pointermove': events.CanvasEvent<'pointermove'>
  'canvas:pointerup': events.CanvasEvent<'pointerup'>
}

export type AssetEventType = Extract<keyof VideoEditorEvents, `asset:${string}`>

export interface Document extends Schema.DocumentSettings {
  readonly currentTime: number
  readonly _currentFrameTime: Ref<Rational>
  readonly duration: number
  readonly timeline: Timeline
  readonly assets: VideoEditorAssetStore
  readonly nodes: NodeMap
  readonly links: Map<string, Schema.NodeLink>
  /** True if the video has no clips */
  readonly isEmpty: boolean

  isDisposed: boolean

  /** @internal */
  activeClipIsStalled: Ref<boolean>

  createNode: <T extends Schema.AnyNode>(init: T) => NodesByType[T['type']]

  createLink: (init: Schema.NodeLink) => Schema.NodeLink
  updateLink: (id: string, nodes: Schema.NodeLink['nodes']) => void
  deleteLink: (id: string) => void

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
  prev: AnyNode | undefined
  next: AnyNode | undefined
  enabled: boolean
  effects: EffectList
  readonly animations: Partial<Record<string, Animation>>
  readonly animationMap: Map<string, Animation>

  isNode: true
  isDisposed: boolean

  getLocalTimeOffset: () => Rational
  _toggleKeyframesAt: (keys: string[], time: Rational) => void
  _insertKeyframeAtTime: (key: string, value: unknown, time: Rational, index?: number) => void

  move: (position: ChildNodePosition | undefined) => void
  remove: () => void
  isTimeline: () => this is Timeline
  isTrack: () => this is AnyTrack
  isTrackChild: () => this is AnyClip
  isClip: () => this is AnyClip
  isMediaClip: () => this is AnyMediaClip
  isImageClip: () => this is ImageClip
  isTextClip: () => this is TextClip
  isVideo: () => this is AnyVideoNode
  isAudio: () => this is AnyAudioNode
  toJSON: () => any
  delete: (deep?: boolean) => void
  dispose: (deep?: boolean) => void
  [Symbol.dispose]: () => void

  /** @internal */
  _fields: <T extends BaseNode>(this: T) => NodeFieldDef<T>[]
  /** @internal */
  _fieldsByKey: <T extends BaseNode>(this: T) => Partial<Record<string | number | symbol, NodeFieldDef<T>>>
}

export interface ParentNode<TChild extends AnyNode> extends BaseNode {
  readonly head?: TChild
  readonly tail?: TChild
  readonly children: TChild[]
  readonly count: number
  /** @internal */
  _unlinkChild: (node: TChild) => void
  /** @internal */
  _positionChildAt: (node: TChild, index: number) => void
  search: (comparator: (a: TChild) => number, value?: undefined, from?: number, to?: number) => number
  search: <U>(comparator: (a: TChild, b: U) => number, value: U, from?: number, to?: number) => number
}

export interface Timeline extends ParentNode<AnyTrack>, Schema.Timeline {
  readonly parent?: undefined
  toJSON: () => Schema.Timeline
}

export interface BaseTrack<TChild extends TrackChild> extends ParentNode<TChild> {
  readonly parent?: Timeline
  readonly duration: Rational
  readonly link: Schema.NodeLink | undefined
  prev: AnyTrack | undefined
  next: AnyTrack | undefined
}
export interface VideoTrack extends BaseTrack<AnyVideoClip>, Schema.VideoTrack {
  toJSON: () => Schema.VideoTrack
}
export interface AudioTrack extends BaseTrack<AnyAudioClip>, Schema.AudioTrack {
  toJSON: () => Schema.AudioTrack
}

export interface TrackChild extends BaseNode {
  duration: Rational
  gap: Rational
  readonly timeRational: ClipTimeRational
  readonly time: ClipTime
  readonly parent?: AnyTrack
  prev: AnyClip | undefined
  next: AnyClip | undefined
  getGap: (prevClipId: string | undefined) => Rational
  setGap: (prevClipId: string | undefined, duration: Schema.Rational) => void
}

export interface BaseClip<T extends string = string> extends TrackChild, Schema.BaseClip {
  type: `clip:${T}`
  name: string
  sourceStart: Rational
  readonly asset?: AnyAsset | undefined
  readonly isReady: boolean
  readonly playableTime: ClipTime
  readonly presentationTime: ClipTime
  readonly expectedMediaTime: number
  readonly isInClipTime: boolean
  readonly isInPresentationTime: boolean
  readonly isInPlayableTime: boolean
  readonly mediaSize: { width: number; height: number }
  readonly link: Schema.NodeLink | undefined
}

export interface VideoClip
  extends BaseClip<'video'>, Omit<Schema.VideoClip, keyof Schema.VisualProps>, Schema.VisualProps {
  readonly asset: MediaAsset | undefined
  linkedAudio?: AudioClip
  toJSON: () => Schema.VideoClip
}
export interface AudioClip extends BaseClip<'audio'>, Schema.AudioClip {
  readonly asset: MediaAsset | undefined
  volume: number
  linkedVideo?: VideoClip
  toJSON: () => Schema.AudioClip
}
export interface ImageClip
  extends BaseClip<'image'>, Omit<Schema.ImageClip, keyof Schema.VisualProps>, Schema.VisualProps {
  readonly asset: ImageAsset | undefined
  toJSON: () => Schema.ImageClip
}
export interface TextClip
  extends BaseClip<'text'>, Omit<Schema.TextClip, keyof Schema.VisualProps>, Schema.VisualProps {
  fontWeight: number
  fontStyle: Schema.FontStyle
  toJSON: () => Schema.TextClip
}

export interface NodesByType {
  timeline: Timeline
  'track:video': VideoTrack
  'track:audio': AudioTrack
  'clip:video': VideoClip
  'clip:audio': AudioClip
  'clip:image': ImageClip
  'clip:text': TextClip
}

export type AnyNode = NodesByType[keyof NodesByType]
export type AnyTrack = NodesByType[Extract<keyof NodesByType, `track:${string}`>]
export type AnyClip = NodesByType[Extract<keyof NodesByType, `clip:${string}`>]
export type AnyMediaClip = VideoClip | AudioClip
export type AnyVideoClip = VideoClip | TextClip | ImageClip
export type AnyAudioClip = AudioClip
export type AnyParentNode = Timeline | AnyTrack
export type AnyVideoNode = Timeline | VideoTrack | AnyVideoClip
export type AnyAudioNode = Timeline | AudioTrack | AudioClip

export type Linkable = AnyTrack | AnyClip

interface BaseAsset<T extends string = string> extends Schema.BaseAsset<T> {
  store: VideoEditorAssetStore
  isBuiltIn: boolean
  toJSON: () => Schema.BaseFileAsset<T>
  isVideo: () => this is (MediaAsset & { video: NonNullable<MediaAsset['video']> }) | ImageAsset
  isAudio: () => this is MediaAsset & { audio: NonNullable<MediaAsset['audio']> }
  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface BaseFileAsset<T extends string = string> extends BaseAsset<T>, Schema.BaseFileAsset<T> {
  readonly blob?: Blob
  readonly blobUrl?: string
  readonly isLoading: boolean
  uri?: string
  setBlob: (blob: Blob | undefined) => void
  setError: (error: unknown) => void
  /** @internal */
  _refreshObjectUrl: () => Promise<void>
}

export interface MediaAsset extends BaseFileAsset<'media:av'>, Readonly<Schema.MediaAsset> {
  toJSON: () => Schema.MediaAsset
}

export interface ImageAsset extends BaseFileAsset<'media:image'>, Readonly<Schema.ImageAsset> {
  toJSON: () => Schema.ImageAsset
}

export interface VideoEffectAsset
  extends BaseAsset<'effect:video'>, Readonly<Required<Schema.VideoEffectAsset>> {
  name: string
  readonly raw: Schema.VideoEffectAsset
  readonly shaders: string[]
  toJSON: () => Schema.VideoEffectAsset
}

export interface FontAsset extends BaseAsset<'font'>, Schema.FontAsset {
  toJSON: () => Schema.FontAsset
}

export interface AssetsByType {
  'asset:media:av': MediaAsset
  'asset:media:image': ImageAsset
  'asset:effect:video': VideoEffectAsset
  'asset:font': FontAsset
}

export type AnyAsset = AssetsByType[keyof AssetsByType]

export type { AssetOrigin } from './schema.d.ts'

export interface GapSelection {
  node: AnyClip
  isNode: false
  next?: AnyClip | undefined
  prev?: AnyClip | undefined
}

export type SelectionItem = AnyClip | GapSelection

export type * from './video-editor.d.ts'
export type VideoEditorChangeEvent = CustomEvent<Schema.SerializedDocument>
export type VideoEditorChangeLoadingEvent = CustomEvent<boolean>

export interface VideoEditorAction {
  id: string
  localeKey: string
  canPerform: (editor: VideoEditor) => boolean
  Icon: () => JSX.Element
  exec: (editor: VideoEditor) => unknown
}

export interface Selection {
  /** An array of the selected nodes */
  nodes: AnyClip[]
  /** An array of the selected gaps */
  gaps: GapSelection[]
  /** An array of the selected nodes and gaps */
  items: SelectionItem[]
  /** Add the clip with the given ID to the selection */
  addNode: (id: string) => void
  /** Add the gap before the clip with the given ID to the selection */
  addGap: (id: string) => void
  /** Remove a node from the selection */
  removeNode: (id: string) => void
  /** Remove a gap from the selection */
  removeGap: (id: string) => void
  /** Check if a node is selected */
  hasNode: (id: string) => boolean
  /** Check if the gap before a node is selected */
  hasGap: (id: string) => boolean
  /** Clear the selction */
  clear: () => void
  dispose: () => void
}

export interface VideoEditorDocumentSync extends EventTarget {
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

  create: <T extends Schema.AnyAsset['type']>(
    init: Extract<Schema.AnyAsset, { type: T }>,
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
    asset: BaseFileAsset,
    source: Blob | string | undefined,
    requestInit?: { signal?: AbortSignal | null },
  ) => Promise<File>

  /** Delete an asset form the store */
  delete: (key: string) => Promise<void>

  createMediaAsset: (source: Blob | string) => Promise<MediaAsset | ImageAsset>

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
  canLoad: (asset: Schema.BaseFileAsset) => boolean
  load: (
    asset: Schema.BaseFileAsset,
    options?: { signal?: AbortSignal | null },
  ) => Promise<{ stream: ReadableStream<Uint8Array>; size?: number }>
}

export interface Rational {
  value: number
  rate: number

  add: (other: Schema.Rational) => Rational
  subtract: (other: Schema.Rational) => Rational
  scale: (scaler: number) => Rational
  toRate: (rate: number) => Rational
  isLessThan: (other: Schema.Rational) => boolean
  isGreaterThan: (other: Schema.Rational) => boolean
  isEqualTo: (other: Schema.Rational) => boolean
  isLte: (other: Schema.Rational) => boolean
  isGte: (other: Schema.Rational) => boolean
  clamp: (min: Schema.Rational, max: Schema.Rational) => Rational
  valueOf: () => number
  toJSON: () => { value: number; rate: number }
  toOTIO: () => { OTIO_SCHEMA: 'RationalTime.1'; rate: number; value: number }
}

export class NodePropList<
  T extends {
    readonly index: number
    next: any
    prev: any
  },
> {
  array: Ref<T[]>
  insert: (index: number, item: T) => void
  update: <K extends keyof T>(index: number, key: K, value: T[K]) => void
  delete: (index: number) => void
  pushInitial: (item: T) => void
  toJSON<J>(this: DLL<{ toJSON: () => J }>): J[] | undefined
}

export interface EffectList extends NodePropList<EffectListItem>, Array<EffectListItem> {}

export interface EffectListItem extends Schema.EffectListItem {
  index: number
  prev: EffectListItem | undefined
  next: EffectListItem | undefined
  asset: VideoEffectAsset | undefined
  toJSON: () => Schema.EffectListItem
}
