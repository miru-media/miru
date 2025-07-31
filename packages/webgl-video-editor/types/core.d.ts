import type { Renderer } from 'webgl-effects'

import type { Effect } from 'reactive-effects/effect'

export type * as Schema from './schema.ts'

type TrackType = 'video' | 'audio'

export interface ClipTime {
  start: number
  source: number
  duration: number
  end: number
}

export interface Clip {
  id: string
  readonly start: number
  duration: number
  sourceStart: number
  filter?: { id: string; name: string; intensity: number }
  parent: Track
  prev: Clip | undefined
  next: Clip | undefined
}

export interface Track {
  id: string
  trackType: TrackType
  children: Clip[]
}

export interface MediaAsset {
  id: string
  name: string
  duration: number
  blob: Blob
  dispose: () => void
}

export interface VideoEditor {
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
  effects: Map<string, Effect>

  /** The currently selected video clip on the timeline. */
  selection?: Clip

  /** The audio and video tracks which contain clips */
  tracks: Track[]

  /** The current editor content */
  state: Schema.Movie

  /** The webgl-effects Renderer instance */
  renderer: Renderer

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
  addClip: (track: Track, source: string | Blob) => Promise<Clip | undefined>

  /** Change the media of the selected clip */
  replaceClipSource: (source: string | Blob) => Promise<void>

  /** Set or remove the filter effect of a clip */
  setClipFilter: (clip: Clip, filterId: string | undefined, intensity: number) => void

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

  /** The editor is busy with an async action */
  isLoading: boolean
  /** Playback is paused */
  isPaused: boolean
  /** The editor has a change that can be undone */
  canUndo: boolean
  /** A change was undone and can be reapplied */
  canRedo: boolean

  /** Undo the last editor action. */
  undo: () => void
  /** Redo the last editor action. */
  redo: () => void

  /** Remove all clips, tracks, effects and media assets and clear the undo history */
  clearAllContentAndHistory: () => Promise<void>

  /** Clear all content and set new content */
  replaceContent: (newContent: Schema.Movie) => Promise<void>

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
