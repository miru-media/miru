import type { Renderer } from 'webgl-effects'

import type { AssetBin } from '../src/constants.ts'
import type { VideoEditor as VideoEditorInternal } from '../src/video-editor.ts'

import type {
  AnyClip,
  AnyTrack,
  Document,
  ImageAsset,
  MediaAsset,
  Selection,
  VideoEditorDocumentSync,
  VideoEffectAsset,
} from './core.d.ts'
import type * as Schema from './schema'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- false positive
export class VideoEditor {
  constructor(options?: { sync?: VideoEditorDocumentSync; assets?: VideoEditorAssetStore })
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

  /** Container for managing selected clips and gaps on the timeline. */
  selection: Selection

  /** The audio and video tracks which contain clips */
  tracks: AnyTrack[]

  /** The state of the asset bin ui */
  activeAssetBin: AssetBin

  /** The webgl-effects Renderer instance */
  readonly effectRenderer: Renderer

  /** Progress from 0 to 1 while exporting */
  readonly exportProgress: number

  readonly viewportContainerSize: { width: number; height: number }
  readonly viewportSize: { width: number; height: number }
  readonly isMobileWorkspace: boolean

  readonly canvasZoom: number

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

  secondsToPixels: (seconds: number) => number
  pixelsToSeconds: (pixels: number) => number

  timelineZoom: {
    secondsPerPixel: number
    zeroToOne: number
    readonly min: number
    readonly max: number
    inc: () => void
    dec: () => void
    secondsToPixels: (seconds: number) => number
    pixelsToSeconds: (pixels: number) => number
  }

  /**
   * Seek to the given time of the video.
   *
   * @param time The seek time in seconds.
   */
  seekTo: (time: number) => void

  /**
   * Add a new track to the timeline.
   *
   * @param type The track the clip will be added to.
   */
  addTrack: (type: 'video' | 'audio') => AnyTrack

  createClipInitWithAsset: (
    asset: MediaAsset | ImageAsset,
    trackType: 'audio' | 'video',
  ) => Schema.AnyMediaClip | Schema.ImageClip

  /**
   * Add a new clip at the end of the most appropriate track.
   *
   * @param asset The media asset attached to the clip.
   */
  addMediaClip: (asset: MediaAsset, track?: AnyTrack) => AnyClip

  /** Change the media of the selected clip */
  replaceClipAsset: (asset: MediaAsset) => void

  /**
   * Create a new media asset with the given source File or URI
   *
   * @param source A Blob or URI string of the clip media.
   */
  createMediaAsset: (source: Blob | string) => Promise<MediaAsset | ImageAsset>

  /**
   * Split a clip by replacing it with two new clips which end and start at the given time.
   *
   * Does nothing and returns undefined if the time is outside the clip.
   *
   * @returns The newly created clip or `undefined.`.
   */
  splitClip: (clip: AnyClip, time: number) => [AnyClip, AnyClip] | undefined

  /** Perform an action on the current selection */
  action: (id: string) => void

  generateId: () => string

  getPartId: (part: string) => string

  /** Adds assets and tracks from the provided JSON object */
  importJson: (newContent: Schema.SerializedDocument) => void

  /**
   * Render and encode the video composition.
   *
   * @returns A promise that resolves to a `Blob`.
   */
  export: (options?: { signal?: AbortSignal }) => Promise<Blob>

  /** Release resources of the video editor and allow it to be garbage collected. */
  dispose: () => void
  [Symbol.dispose]: () => void
}
