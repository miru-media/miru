import { timeout } from '@/utils'
import { ArrayBufferTarget, Muxer, type MuxerOptions } from 'mp4-muxer'

import { type DemuxerChunkInfo, type MP4BoxAudioTrack, type MP4BoxVideoTrack, MP4Demuxer } from './demuxer'
import { assertDecoderConfigIsSupported, assertEncoderConfigIsSupported } from './utils'

export interface TrimOptions {
  /** The time in seconds of the original video to trim from.  */
  start: number
  /** The time in seconds of the original video to trim until.  */
  end: number
  /** Whether to include the existing audio track in the output. */
  mute?: boolean
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
  if (!onProgress) return trim_(url, options)

  let progress = 0
  let lastProgress = 0
  let rafId = 0

  const rafLoop = () => {
    if (progress !== lastProgress) onProgress(progress)
    lastProgress = progress
    rafId = requestAnimationFrame(rafLoop)
  }
  rafLoop()

  return trim_(url, {
    ...options,
    onProgress: (value) => (progress = value),
  }).finally(() => {
    onProgress(progress)
    cancelAnimationFrame(rafId)
  })
}

export const trim_ = async (url: string, options: TrimOptions) => {
  if (typeof VideoDecoder === 'undefined') throw new Error('Missing VideoDecoder support.')
  if (typeof VideoEncoder === 'undefined') throw new Error('Missing VideoEncoder support.')

  const demuxer = new MP4Demuxer()
  const config = await demuxer.init(url)

  const videoTrack = config.info.videoTracks[0] as MP4BoxVideoTrack | undefined
  const audioTrack = config.info.audioTracks[0] as MP4BoxAudioTrack | undefined

  if (!videoTrack) throw new Error(`File doesn't contain a video track.`)
  const decoderConfig = demuxer.getConfig(videoTrack)

  await assertDecoderConfigIsSupported(decoderConfig)

  const withAudio = audioTrack && !options.mute
  const { width, height } = videoTrack.video

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      rotation: Array.from(videoTrack.matrix).map((n, i) => n / (i % 3 === 2 ? 2 ** 30 : 2 ** 16)) as any,
    },
    audio: withAudio
      ? {
          codec: 'aac',
          sampleRate: audioTrack.audio.sample_rate,
          numberOfChannels: audioTrack.audio.channel_count,
        }
      : undefined,
    fastStart: options.fastStart ?? false,
  })

  const startTimeUs = options.start * 1_000_000
  const endTimeUs = options.end * 1_000_000
  let firstVideoChunkTimestamp = -1

  let decodeError: unknown
  let encodeError: unknown

  const videoDecoder = new VideoDecoder({
    output(frame) {
      const { timestamp } = frame

      if (videoEncoder.state === 'closed') {
        frame.close()
        return
      }

      const useFrame = () => {
        if (firstVideoChunkTimestamp === -1) firstVideoChunkTimestamp = timestamp
        videoEncoder.encode(frame)
        frame.close()
      }

      if (options.start === 0) {
        useFrame()
        return
      }

      if (timestamp < startTimeUs) {
        frame.close()
        options.onProgress?.(Math.max(0, timestamp) / endTimeUs)
        return
      }

      useFrame()
    },
    error(error) {
      decodeError = error
    },
  })

  videoDecoder.configure(decoderConfig)

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta, chunk.timestamp - firstVideoChunkTimestamp)
      options.onProgress?.(chunk.timestamp / endTimeUs)
    },
    error: (error) => (encodeError = error),
  })

  const MAX_AREA_LEVEL_30 = 1280 * 720
  const codec = `avc1.4200${(width * height > MAX_AREA_LEVEL_30 ? 40 : 31).toString(16)}`
  const encoderConfig = {
    codec,
    width,
    height,
    bitrate: 1_000_000,
  }

  await assertEncoderConfigIsSupported(encoderConfig)

  videoEncoder.configure(encoderConfig)

  let firstAudioChunkTimestamp = 0
  const onAudioChunk = (chunk: DemuxerChunkInfo) => {
    const { timestamp } = chunk
    if (timestamp < startTimeUs) return

    firstAudioChunkTimestamp ||= timestamp
    muxer.addAudioChunkRaw(
      new Uint8Array(chunk.data),
      chunk.type,
      chunk.timestamp - firstAudioChunkTimestamp,
      chunk.duration,
    )
  }

  await demuxer.start(
    [
      { callback: (chunk: EncodedVideoChunk) => videoDecoder.decode(chunk), track: videoTrack },
      ...(withAudio ? [{ callback: onAudioChunk, track: audioTrack }] : []),
    ],
    options.start,
    options.end,
  )

  demuxer.stop()

  await timeout(10)
  if (decodeError != null) throw decodeError as unknown
  await videoDecoder.flush()

  await timeout(10)
  if (encodeError != null) throw encodeError as unknown
  await videoEncoder.flush()

  muxer.finalize()
  options.onProgress?.(1)

  const { buffer } = muxer.target
  return new Blob([buffer], { type: 'video/mp4' })
}
