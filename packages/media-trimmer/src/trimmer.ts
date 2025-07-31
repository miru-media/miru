import * as mp4Muxer from 'mp4-muxer'
import * as webmMuxer from 'webm-muxer'

import { IS_LIKE_MAC, IS_SAFARI_16 } from 'shared/userAgent'
import { Janitor } from 'shared/utils'
import { VideoEncoderTransform } from 'shared/video/coder-transforms'
import { Demuxer } from 'shared/video/demuxer'
import type { AudioMetadata, EncodedMediaChunk, VideoMetadata } from 'shared/video/types'
import {
  assertDecoderConfigIsSupported,
  hasVideoDecoder,
  setVideoEncoderConfigCodec,
} from 'shared/video/utils'

import type { FrameExtractor } from './frame-extractor.ts'
import { RvfcExtractor } from './rvfc-extractor.ts'
import type { TrimOptions } from './types/media-trimmer.ts'
import { assertHasRequiredApis } from './utils.ts'
import { VideoDecoderExtractor } from './video-decoder-extractor.ts'

const MUXER_CODEC_ID_MAP: Record<'webm' | 'mp4', Record<string, string>> = {
  mp4: { vp09: 'vp9', av01: 'av1', avc1: 'avc', hev1: 'hevc', opus: 'opus', mp4a: 'aac' },
  webm: {
    vp09: 'V_VP9',
    vp8: 'V_VP8',
    av01: 'V_AV1',
    avc1: 'V_MPEG4/ISO/AVC',
    hev1: 'V_MPEGH/ISO/HEVC',
    opus: 'A_OPUS',
    vorbis: 'A_VORBIS',
  },
}

export class Trimmer {
  url: string
  options: TrimOptions
  rotation!: number
  janitor?: Janitor
  videoOutCodec!: string

  constructor(url: string, options: TrimOptions) {
    this.url = url
    this.options = options
  }

  async trim() {
    const { onProgress } = this.options
    onProgress?.(0)
    this.janitor?.dispose()
    const blob = await this._trim().finally(this.dispose.bind(this))
    onProgress?.(1)
    return blob
  }

  async _trim() {
    assertHasRequiredApis()
    const { options } = this

    const janitor = (this.janitor = new Janitor())
    const abort = new AbortController()

    let done = false
    janitor.add(() => {
      if (!done && !abort.signal.aborted) abort.abort()
    })

    const { demuxer, metadata } = await this.initDemuxer(abort)
    const { video, audio } = metadata

    const withAudio = !!audio && !options.mute
    this.rotation = video?.rotation ?? 0

    if (!video && !audio) throw new Error('Input media has no video or audio tracks.')

    const videoEncoderConfig: VideoEncoderConfig | undefined = video && {
      ...options.videoEncoderConfig,
      codec: video.codec,
      width: video.codedWidth,
      height: video.codedHeight,
      framerate: isNaN(video.fps) ? undefined : video.fps,
    }

    if (video) {
      await setVideoEncoderConfigCodec(videoEncoderConfig!)
      this.videoOutCodec =
        options.videoEncoderConfig?.codec ?? (metadata.type === 'mp4' ? `avc1.420028` : video.codec)
    }

    const muxerVideoCodecId = video
      ? MUXER_CODEC_ID_MAP[metadata.type][this.videoOutCodec.replace(/\..*/, '')]
      : ''

    const muxerOptions = {
      video: video && {
        codec: muxerVideoCodecId as any,
        width: video.codedWidth,
        height: video.codedHeight,
        rotation: video.matrix,
      },
      audio: withAudio
        ? {
            codec: MUXER_CODEC_ID_MAP[metadata.type][audio.codec.replace(/\..*/, '')] as any,
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.numberOfChannels,
          }
        : undefined,
    } satisfies Omit<webmMuxer.MuxerOptions<any> | mp4Muxer.MuxerOptions<any>, 'target'>

    const muxer =
      metadata.type === 'mp4'
        ? new mp4Muxer.Muxer({
            ...muxerOptions,
            target: new mp4Muxer.ArrayBufferTarget(),
            fastStart: 'in-memory',
          })
        : new webmMuxer.Muxer({ ...muxerOptions, target: new webmMuxer.ArrayBufferTarget() })

    const mediaTrackPromises: Promise<void>[] = []

    if (video && videoEncoderConfig) {
      await Promise.all([
        setVideoEncoderConfigCodec(videoEncoderConfig),
        hasVideoDecoder() && assertDecoderConfigIsSupported('video', video),
      ])

      mediaTrackPromises.push(this.pipeVideo({ demuxer, video, encoderConfig: videoEncoderConfig, muxer }))
    }

    if (withAudio) {
      mediaTrackPromises.push(this.pipeAudio({ demuxer, muxer, audio, signal: abort.signal }))
    }

    demuxer.start()

    await Promise.all(mediaTrackPromises)

    muxer.finalize()
    done = true

    const { buffer } = muxer.target
    return new Blob([buffer], { type: 'video/webm' })
  }

  async initDemuxer(abort: AbortController) {
    const { credentials } = this.options

    const demuxer = new Demuxer()
    const metadata = await demuxer.init(this.url, {
      credentials,
      signal: abort.signal,
    })

    this.janitor!.add(() => demuxer.stop())
    return { demuxer, metadata }
  }

  async pipeVideo({
    demuxer,
    video,
    encoderConfig,
    muxer,
  }: {
    demuxer: Demuxer
    video: VideoMetadata
    encoderConfig: VideoEncoderConfig
    muxer: mp4Muxer.Muxer<any> | webmMuxer.Muxer<any>
  }) {
    const { rotation: angle } = this
    const options = { ...this.options, videoInfo: video, angle }
    let extractor: FrameExtractor

    try {
      if (
        !hasVideoDecoder() ||
        (IS_SAFARI_16 && IS_LIKE_MAC) // Broken VideoDecoder implementation?
      )
        throw new Error('Video decoder is unavailable')

      extractor = new VideoDecoderExtractor(demuxer, options)
    } catch {
      extractor = new RvfcExtractor(this.url, options)
    }

    const endTimeUs = options.end * 1_000_000

    let firstVideoFrameTimeUs = -1

    await extractor
      .start()
      .pipeThrough(new VideoEncoderTransform(encoderConfig))
      .pipeTo(
        new WritableStream({
          write: ([chunk, meta]) => {
            if (firstVideoFrameTimeUs < 0) firstVideoFrameTimeUs = chunk.timestamp
            muxer.addVideoChunk(chunk, meta, chunk.timestamp - firstVideoFrameTimeUs)
            options.onProgress?.(chunk.timestamp / endTimeUs)
          },
        }),
      )
  }

  async pipeAudio({
    demuxer,
    muxer,
    audio,
    signal,
  }: {
    demuxer: Demuxer
    muxer: mp4Muxer.Muxer<mp4Muxer.ArrayBufferTarget> | webmMuxer.Muxer<webmMuxer.ArrayBufferTarget>
    audio: AudioMetadata
    signal: AbortSignal
  }) {
    const startTimeUs = this.options.start * 1e6
    const endTimeUs = this.options.end * 1e6

    let firstAudioChunkTimestamp = -1

    const { codec, sampleRate, numberOfChannels, description } = audio
    const meta: EncodedAudioChunkMetadata = {
      decoderConfig: { codec, sampleRate, numberOfChannels, description },
    }

    const abort = new AbortController()
    signal.addEventListener('abort', () => abort.abort())

    try {
      await demuxer.getChunkStream(audio).pipeTo(
        new WritableStream({
          write: (chunk: EncodedMediaChunk, controller) => {
            const { timestamp } = chunk
            if (timestamp < startTimeUs) return
            if (timestamp >= endTimeUs) {
              abort.abort()
              return
            }

            if (firstAudioChunkTimestamp === -1) firstAudioChunkTimestamp = timestamp

            try {
              const uint8 = new Uint8Array(chunk.data)
              const trimmedTimestamp = timestamp - firstAudioChunkTimestamp

              if (muxer instanceof mp4Muxer.Muxer)
                muxer.addAudioChunkRaw(uint8, chunk.type, trimmedTimestamp, chunk.duration!)
              else muxer.addAudioChunkRaw(uint8, chunk.type, trimmedTimestamp, meta)
            } catch (error) {
              controller.error(error)
            }
          },
        }),
        { signal: abort.signal },
      )
    } catch (error: unknown) {
      if (!abort.signal.aborted) throw error
    }
  }

  dispose() {
    this.janitor?.dispose()
  }
}
