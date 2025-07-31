export interface TrimOptions {
  /** The time in seconds of the original video to trim from.  */
  start: number
  /** The time in seconds of the original video to trim until.  */
  end: number
  /** Whether to include the existing audio track in the output. */
  mute?: boolean
  /**
   * A subset set of VideoEncoder config options.
   * https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder/encode
   */
  videoEncoderConfig?: {
    codec?: string
    bitrate?: number
    latencyMode?: LatencyMode
    hardwareAcceleration?: HardwareAcceleration
  }
  /** Credentials for fetching and demuxing URL */
  credentials?: RequestCredentials
  /** How to handle cross origin URL for RVFC decoder */
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  /** A callback function that will be called with the progress of the trim */
  onProgress?: (
    /** A value between 0 and 1 */
    value: number,
  ) => unknown
}

/**
 *
 * @param url The url of the input file. The file must be a `.mp4`/`.mov` file with a video tra
 *            and the browser must support the WebCodecs API with the codecs in the video.
 * @param options An object with start, end, and other options.
 * @returns A promise that resolves to a Blob of the new, trimmed video file.
 *
 * @example
 * import { trim } from 'media-trimmer'
 *
 * try {
 *   const blob = await trim('video.mp4', {
 *     start: 2,    // start time in seconds
 *     end: 10,     // end time in seconds
 *     mute: false, // ignore the audio track?
 *   })
 * } catch (error) {
 *   alert(error)
 * }
 */
export declare const trim: (url: string, options: TrimOptions) => Promise<Blob>

export default trim

export * from './utils.ts'
export type * from './ui.ts'
