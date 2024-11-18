import { decodeAsyncImageSource, Janitor, promiseWithResolvers, timeout } from '@/utils'
import { ArrayBufferTarget, Muxer, type MuxerOptions } from 'mp4-muxer'

import { type DemuxerChunkInfo, type MP4BoxVideoTrack, MP4Demuxer } from './demuxer'
import { RvfcExtractor } from './RvfcExtractor'
import { assertHasRequiredApis } from './utils'
import { VideoDecoderExtractor } from './VideoDecoderExtractor'

export interface TrimOptions {
  /** The time in seconds of the original video to trim from.  */
  start: number
  /** The time in seconds of the original video to trim until.  */
  end: number
  /** Whether to include the existing audio track in the output. */
  mute?: boolean
  /** Credentials for fetching and demuxing URL */
  credentials?: RequestCredentials
  /** How to handle cross origin URL for RVFC decoder */
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  /** Callback that will be called with the progress of the trim */
  onProgress?: (
    /** A value between 0 and 1 */
    value: number,
  ) => unknown
  /** @internal */
  fastStart?: MuxerOptions<ArrayBufferTarget>['fastStart']
}

export const trim = async (url: string, options: TrimOptions) => {
  const { onProgress } = options
  const janitor = new Janitor()

  if (!onProgress) return trim_(url, options, janitor).finally(() => janitor.dispose())

  let progress = 0
  let lastProgress = -1
  let rafId = 0

  const rafLoop = () => {
    if (progress !== lastProgress) onProgress(progress)
    lastProgress = progress
    rafId = requestAnimationFrame(rafLoop)
  }
  rafLoop()

  options = { ...options, onProgress: (value) => (progress = value) }

  return trim_(url, options, janitor).finally(() => {
    janitor.dispose()
    onProgress(progress)
    cancelAnimationFrame(rafId)
  })
}

export const trim_ = async (url: string, options: TrimOptions, janitor: Janitor) => {
  assertHasRequiredApis()

  const abort = new AbortController()
  const demuxer = new MP4Demuxer()
  const mp4Info = await demuxer.init(url, { credentials: options.credentials, signal: abort.signal })

  const videoTrack = mp4Info.videoTracks[0] as MP4BoxVideoTrack | undefined
  const audioTrack = options.mute ? undefined : mp4Info.audioTracks[0]

  if (!videoTrack) throw new Error(`File doesn't contain a video track.`)

  let videoExtractor

  try {
    videoExtractor = new VideoDecoderExtractor(demuxer, videoTrack, options.start, options.end)
    await videoExtractor.configure()
  } catch {
    const { promise, media, close } = decodeAsyncImageSource(url, options.crossOrigin, true)
    janitor.add(close)
    await promise

    const { nb_samples, duration, timescale } = videoTrack
    const fps = nb_samples / (duration / timescale)
    videoExtractor = new RvfcExtractor(media, options.start, options.end, fps)
  }

  const { width, height } = videoTrack.video

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      rotation: Array.from(videoTrack.matrix).map((n, i) => n / (i % 3 === 2 ? 2 ** 30 : 2 ** 16)) as any,
    },
    audio: audioTrack && {
      codec: 'aac',
      sampleRate: audioTrack.audio.sample_rate,
      numberOfChannels: audioTrack.audio.channel_count,
    },
    fastStart: options.fastStart ?? false,
  })

  const startTimeUs = options.start * 1_000_000
  const endTimeUs = options.end * 1_000_000

  const encodePromise = promiseWithResolvers()

  videoExtractor.start((frame, trimmedTimestamp) => {
    if (videoEncoder.state !== 'configured') {
      frame.close()
      return
    }

    if (trimmedTimestamp >= 0) videoEncoder.encode(frame)

    frame.close()
  }, abort.signal)

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta, chunk.timestamp - videoExtractor.firstFrameTimestamp)
      options.onProgress?.(chunk.timestamp / endTimeUs)
    },
    error: (error) => {
      encodePromise.reject(error)
      abort.abort(error)
    },
  })

  const MAX_AREA_LEVEL_30 = 1280 * 720
  const codec = `avc1.4200${(width * height > MAX_AREA_LEVEL_30 ? 40 : 31).toString(16)}`
  const encoderConfig = {
    codec,
    width,
    height,
    bitrate: 1_000_000,
  }

  videoEncoder.configure(encoderConfig)

  if (audioTrack) {
    let firstAudioChunkTimestamp = -1

    demuxer.setExtractionOptions(
      audioTrack,
      (chunk: DemuxerChunkInfo) => {
        const { timestamp } = chunk
        if (timestamp < startTimeUs) return
        if (firstAudioChunkTimestamp === -1) firstAudioChunkTimestamp = timestamp

        muxer.addAudioChunkRaw(
          new Uint8Array(chunk.data),
          chunk.type,
          timestamp - firstAudioChunkTimestamp,
          chunk.duration,
        )
      },
      encodePromise.resolve,
    )
  }

  janitor.add(() => {
    demuxer.stop()
    videoExtractor.stop()
    if (videoEncoder.state === 'configured') videoEncoder.close()
  })

  demuxer.start(options.start, options.end)
  await demuxer.flush()
  await timeout(500)
  await videoExtractor.flush()
  await videoEncoder.flush()
  muxer.finalize()
  options.onProgress?.(1)

  const { buffer } = muxer.target
  return new Blob([buffer], { type: 'video/mp4' })
}
