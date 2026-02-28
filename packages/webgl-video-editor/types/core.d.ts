import type { Ref } from 'fine-jsx'
import type { EffectDefinition, Renderer } from 'webgl-effects'

import type {
  AssetCreateEvent,
  AssetDeleteEvent,
  AssetRefreshEvent,
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
} from './events'
import type * as Schema from './schema.ts'
export * from './events'

export { Schema }

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

export interface VideoEditorEvents {
  error: ErrorEvent

  'doc:dispose': DocDisposeEvent
  'settings:update': SettingsUpdateEvent

  'node:create': NodeCreateEvent
  'node:move': NodeMoveEvent
  'node:update': NodeUpdateEvent
  'node:delete': NodeDeleteEvent

  'asset:create': AssetCreateEvent
  'asset:refresh': AssetRefreshEvent
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

export interface Document extends Schema.DocumentSettings {
  readonly currentTime: number
  readonly duration: number
  readonly timeline: Timeline
  readonly assets: Map<string, AnyAsset>
  readonly nodes: NodeMap
  readonly isEmpty: boolean

  isDisposed: boolean

  /** @internal */
  activeClipIsStalled: Ref<boolean>

  createNode: <T extends Schema.AnyNodeSchema>(init: T) => NodesByType[T['type']]
  createAsset: <T extends Schema.AnyAsset>(
    init: T,
    source?: Blob | string,
  ) => T extends Schema.VideoEffectAsset ? VideoEffectAsset : MediaAsset
  seekTo: (time: number) => void
  _setCurrentTime: (time: number) => void
  importFromJson: (content: Schema.SerializedDocument) => void
  on: <T extends Extract<keyof VideoEditorEvents, string>>(
    type: T,
    listener: (event: VideoEditorEvents[T]) => void,
    options?: AddEventListenerOptions,
  ) => void
  emit: (event: VideoEditorEvents[keyof VideoEditorEvents]) => void
  dispose: () => void
}

export interface NodeMap {
  map: Map<string, AnyNode>
  byType: {
    [Type in keyof NodesByType]: Set<NodesByType[Type]>
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  get: <T extends AnyNode>(id: string) => T
  set: (node: AnyNode) => void
  has: (id: string) => boolean
  delete: (id: string) => void
}

export interface BaseNode {
  readonly doc: Document
  readonly parent?: AnyParentNode
  prev?: AnyNode
  next?: AnyNode
  readonly index: number
  isDisposed: boolean
  move: (position: ChildNodePosition | undefined) => void
  remove: () => void
  isTimeline: () => this is Timeline
  isTrack: () => this is Track
  isClip: () => this is AnyClip
  isGap: () => this is Gap
  isVisual: () => this is Timeline | Track | VisualClip
  isAudio: () => this is Timeline | Track | AudioClip
  toObject: () => any
  getSnapshot: () => NodeSnapshot<T extends Schema.AnyNodeSchema ? T : any>
  dispose: () => void
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
  readonly parent: undefined
  readonly trackCount: number
  toObject: () => Schema.Timeline
}

type TrackType = 'video' | 'audio'

export interface Track extends ParentNode<AnyTrackChild>, Schema.Track {
  readonly trackType: TrackType
  readonly parent?: Timeline
  readonly firstClip?: AnyClip
  readonly lastClip?: AnyClip
  readonly clips: AnyClip[]
  readonly clipCount: number
  readonly duration: number
  prev?: Track
  next?: Track
  toObject: () => Schema.Track
}

export interface TrackChild extends BaseNode {
  readonly time: ClipTime
  readonly parent?: Track
  prev?: AnyTrackChild | undefined
  next?: AnyTrackChild | undefined
  readonly prevClip?: AnyClip | undefined
  readonly nextClip?: AnyClip | undefined
}

export interface Clip<T extends Schema.BaseClip> extends TrackChild, Schema.BaseClip<T['clipType']> {
  readonly isReady: boolean
  readonly sourceAsset: MediaAsset | undefined
  readonly playableTime: ClipTime
  readonly presentationTime: ClipTime
  readonly expectedMediaTime: number
  readonly isInClipTime: boolean
}

export interface VisualClip extends Clip<Schema.VisualClip>, Schema.VisualClip {
  position: { x: number; y: number }
  rotation: number
  scale: { x: number; y: number }
  toObject: () => Schema.VisualClip
}
export interface AudioClip extends Clip<Schema.AudioClip>, Schema.AudioClip {
  volume: number
  mute: boolean
  toObject: () => Schema.AudioClip
}

export interface Gap extends TrackChild, Schema.Gap {}

export interface NodesByType {
  timeline: Timeline
  track: Track
  clip: VisualClip | AudioClip
  gap: Gap
}

export type AnyNode = NodesByType[keyof NodesByType]
export type AnyClip = NodesByType['clip']
export type AnyTrackChild = AnyClip | Gap
export type AnyParentNode = Timeline | Track
export type AnyVisualNode = Timeline | Track | VisualClip
export type AnyAudioNode = Timeline | Track | AudioClip

export interface MediaAsset extends Schema.AvMediaAsset {
  readonly blob?: Blob
  readonly objectUrl: string
  readonly isLoading: boolean
  setBlob: (blob: Blob | null | undefined) => void
  setError: (error: unknown) => void
  toObject: () => Schema.AvMediaAsset
  dispose: () => void
  /** @internal */
  _refreshObjectUrl: () => Promise<void>
}

export interface VideoEffectAsset extends Schema.VideoEffectAsset {
  readonly raw: EffectDefinition
  toObject: () => Schema.VideoEffectAsset
  dispose: () => void
}

export type AnyAsset = MediaAsset | VideoEffectAsset

export interface VideoEditor {
  store?: VideoEditorStore

  /** The canvas that the video is rendered to */
  canvas: HTMLCanvasElement

  /** The width and height of the video */
  resolution: {
    width: number
    height: number
  }

  /** The frames per second of the video */
  frameRate: number

  /** True if the video has no clips */
  isEmpty: boolean

  /** The current playback time of the video timeline */
  currentTime: number

  /** The webgl-effects that are loaded into the editor */
  effects: Map<string, VideoEffectAsset>

  /** The currently selected video clip on the timeline. */
  selection?: AnyClip | Gap

  /** The audio and video tracks which contain clips */
  tracks: Track[]

  /** The current editor content */
  state: Schema.SerializedDocument

  /** The webgl-effects Renderer instance */
  effectRenderer: Renderer

  /** Select the given track item */
  select: (clip: AnyTrackChild | undefined) => void

  /** Play the video at the current time or from the start if the video is ended. */
  play: () => void
  /** Play the video. */
  pause: () => void
  /**
   * Seek to the given time of the video.
   * @param time The time of the video to seek to in seconds.
   */
  seekTo: (time: number) => void

  /**
   * Add a new clip at the end of the specified track.
   *
   * @param track The track the clip will be added to.
   * @param source A Blog or url string of the clip media.
   */
  addClip: (
    track: Track,
    source: string | Blob | Schema.AnyClip,
    options?: AddNodeOptions,
  ) => Promise<AnyClip> | AnyClip

  /** Change the media of the selected clip */
  replaceClipSource: (source: string | Blob) => Promise<void>

  /**
   * Add a new clip at the end of the specified track.
   *
   * @param track The track the clip will be added to.
   * @param source A Blog or url string of the clip media.
   */
  createMediaAsset: (source: string | Blob) => Promise<MediaAsset>

  /**
   * Split a clip that intersects with the current video time.
   * If a clip is selected, its track will be searched for an intersecting clip.
   * If a clip isn't found, all tracks are then searched in order.
   * When a clip is found, its duration is reduced and a similar clip is inserted after it.
   *
   * @returns The newly created clip or `undefined.`.
   */
  splitClipAtCurrentTime: () => [AnyClip, AnyClip] | undefined

  /** Delete the selected clip */
  deleteSelection: () => void

  /** Playback is paused */
  isPaused: boolean

  /** Adds assets and tracks from the provided JSON object */
  importJson: (newContent: Schema.SerializedDocument) => void

  /**
   * Render and encode the video composition.
   * @returns A promise that resolves to an object with a `blob` field and a "blob:" `url` field to the resulting video file.
   */
  export: () => Promise<{ blob: Blob; url: string } | undefined>
  /** The most recent export result. */
  exportResult: { blob: Blob; url: string } | undefined

  toObject: () => Schema.SerializedDocument

  /** Release resources of the video editor and allow it to be garbage collected. */
  dispose: () => void
}

export type VideoEditorChangeEvent = CustomEvent<Schema.SerializedDocument>
export type VideoEditorChangeLoadingEvent = CustomEvent<boolean>

export interface VideoEditorStore {
  init: (editor: VideoEditor) => void

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
  /** @internal @hidden */
  untracked: <T>(fn: () => T) => T

  /** Clear undo hsitory */
  reset: () => void

  /** Get an Iterable of all media asset files that are available to the project */
  listFiles: () => Iterable<Schema.AnyAsset>

  /** The entire file has been stored and can be retrieved */
  hasCompleteFile: (key: string) => Promise<boolean>

  /** Save a new file from a source stream */
  createFile: (
    asset: Asset,
    stream: ReadableStream<Uint8Array>,
    options: {
      size?: number
      onProgress?: (progress: number) => void
      signal?: AbortSignal | null
    },
  ) => Promise<void>
  /** Get a media asset as a File instance */
  getFile: (key: string, name?: string, options?: FilePropertyBag) => Promise<File>
  /** Delete a media asset form the store */
  deleteFile: (key: string) => Promise<void>

  /** Dispose this history object */
  dispose: () => void
}
