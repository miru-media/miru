import type { EffectDefinition, Renderer } from 'webgl-effects'

import type * as Schema from './schema.ts'

export { Schema }

export interface ChildNodePosition {
  parentId: string
  index: number
}

type TrackType = 'video' | 'audio'

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

export interface Movie extends Schema.Movie {
  dispose: () => void
}

export interface Clip extends Schema.Clip {
  readonly start: number
  parent?: Track
  prev?: Clip | undefined
  next?: Clip | undefined
  dispose: () => void
}

export interface Track {
  id: string
  trackType: TrackType
  parent?: Timeline
  children: Clip[]
  dispose: () => void
}

export interface MediaAsset extends Schema.AvMediaAsset {
  blob: Blob
  dispose: () => void
}

export interface VideoEffectAsset extends Schema.VideoEffectAsset {
  raw: EffectDefinition
  dispose: () => void
}

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
  selection?: Clip

  /** The audio and video tracks which contain clips */
  tracks: Track[]

  /** The current editor content */
  state: Schema.Movie

  /** The webgl-effects Renderer instance */
  effectRenderer: Renderer

  /** Select the given clip */
  selectClip: (clip: Clip | undefined) => void

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
    source: string | Blob | Schema.Clip,
    options?: AddNodeOptions,
  ) => Promise<Clip> | Clip

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
  splitClipAtCurrentTime: () => Clip | undefined

  /** Delete the selected clip */
  deleteSelection: () => void

  /** Playback is paused */
  isPaused: boolean

  /** Adds assets and tracks from the provided JSON object */
  importJson: (newContent: Schema.SerializedMovie) => void

  /**
   * Render and encode the video composition.
   * @returns A promise that resolves to an object with a `blob` field and a "blob:" `url` field to the resulting video file.
   */
  export: () => Promise<{ blob: Blob; url: string } | undefined>
  /** The most recent export result. */
  exportResult: { blob: Blob; url: string } | undefined

  toObject: () => Schema.Movie

  /** Release resources of the video editor and allow it to be garbage collected. */
  dispose: () => void
}

export type VideoEditorChangeEvent = CustomEvent<Schema.Movie>
export type VideoEditorChangeLoadingEvent = CustomEvent<boolean>

export interface VideoEditorStore {
  init: (editor: pub.VideoEditor) => void

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
