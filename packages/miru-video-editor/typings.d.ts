import type * as schema from './nodes/schema'

type TrackType = 'video' | 'audio'

export interface Clip {
  id: string
  readonly start: number
  duration: number
  sourceStart: number
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
  dispose(): void
}

export interface VideoEditor {
  /** The currently selected video clip on the timeline. */
  selection?: Clip
  tracks: Track[]

  selectClip(clip)
  /** @param time The time of the movie to seek to in seconds. */
  seekTo(time: number)

  /**
   * Add a new clip at the end of the specified track.
   *
   * @param track The track the clip will be added to.
   * @param source A Blog or url string of the clip media.
   */
  addClip(track, source: string | Blob): Promise<void>

  /**
   * Add a new clip at the end of the specified track.
   *
   * @param track The track the clip will be added to.
   * @param source A Blog or url string of the clip media.
   */
  createMediaAsset(source: string | Blob): Promise<MediaAsset>

  /**
   * Split a clip that intersects with the current video time.
   * If a clip is selected, its track will be searched for an intersecting clip.
   * If a clip isn't found, all tracks are then searched in order.
   * When a clip is found, its duration is reduced and a similar clip is inserted after it.
   *
   * @returns The newly created clip or `undefined.`.
   */
  splitClipAtCurrentTime(): Clip | undefined

  isLoading: boolean

  canUndo: boolean
  canRedo: boolean
  /** Undo the last editor action. */
  undo(): void
  /** Redo the last editor action. */
  redo(): void

  clearAllContentAndHistory(): Promise<void>
  replaceContent(newContent: schema.Movie): Promise<void>

  toObject(): schema.Movie

  /**
   * Render and encode the video composition.
   * @returns A promise that resolves to an object with a `blob` field and a "blob:" `url` field to the resulting video file.
   */
  export(): Promise<{ blob: Blob; url: string } | undefined>
  /** The most recent export result. */
  exportResult: { blob: Blob; url: string } | undefined

  /** Release resources of the video editor and allow it to be garbage collected. */
  dispose(): void
}

export type VideoEditorChangeEvent = CustomEvent<Schema.Movie>
export type VideoEditorChangeLoadingEvent = CustomEvent<boolean>
