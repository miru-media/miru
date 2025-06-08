import * as mp4Muxer from 'mp4-muxer'
import * as webmMuxer from 'webm-muxer'

import { IS_LIKE_MAC, IS_SAFARI } from 'shared/userAgent'
import { Janitor, promiseWithResolvers } from 'shared/utils'
import { Demuxer } from 'shared/video/Demuxer'
import { type FrameExtractor } from 'shared/video/FrameExtractor'
import { RvfcExtractor } from 'shared/video/RvfcExtractor'
import {
  type AudioMetadata,
  type MediaChunk,
  type MP4BoxFileInfo,
  type MP4BoxVideoTrack,
  type VideoMetadata,
} from 'shared/video/types'
import { assertEncoderConfigIsSupported } from 'shared/video/utils'
import { VideoDecoderExtractor } from 'shared/video/VideoDecoderExtractor'

import { type TrimOptions } from './types/media-trimmer'
import { assertHasRequiredApis } from './utils'

type MuxerRotation = [number, number, number, number, number, number, number, number, number]

interface PromiseResolvers {
  resolve: () => void
  reject: (reason: unknown) => void
}

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

    if (video) {
      this.videoOutCodec =
        options.videoEncoderConfig?.codec ?? (metadata.type === 'mp4' ? `avc1.420028` : video.codec)
    }

    const muxerVideoCodecId = MUXER_CODEC_ID_MAP[metadata.type][this.videoOutCodec.replace(/\..*/, '')]

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
      fastStart: 'in-memory',
    } as const

    const muxer =
      metadata.type === 'mp4'
        ? new mp4Muxer.Muxer({ ...muxerOptions, target: new mp4Muxer.ArrayBufferTarget() })
        : new webmMuxer.Muxer({ ...muxerOptions, target: new webmMuxer.ArrayBufferTarget() })

    const frameExtractor = video && (await this.createFrameExtractor(demuxer, video))
    const videoEncoder =
      video &&
      frameExtractor &&
      (await this.createVideoEncoder(frameExtractor, muxer, (error) => abort.abort(error)))

    if (frameExtractor && videoEncoder) {
      frameExtractor.start((frame, trimmedTimestamp) => {
        if (videoEncoder.state === 'configured' && trimmedTimestamp >= 0) videoEncoder.encode(frame)
        frame.close()
      }, abort.signal)
    }

    const audioRemuxPromise = promiseWithResolvers()
    if (withAudio) {
      this.setAudioRemuxing(demuxer, muxer, audio, {
        resolve: audioRemuxPromise.resolve,
        reject: (error) => {
          audioRemuxPromise.reject(error)
          abort.abort(error)
        },
      })
    } else audioRemuxPromise.resolve()

    await demuxer.start(options.start, options.end)
    await frameExtractor?.flush()
    await Promise.all([videoEncoder?.flush(), audioRemuxPromise.promise])

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

  getTracks(info: MP4BoxFileInfo, mute?: boolean) {
    const { videoTracks, audioTracks } = info
    const videoTrack = videoTracks[0] as MP4BoxVideoTrack | undefined
    if (!videoTrack) throw new Error(`File doesn't contain a video track.`)

    const rotation = Array.from(videoTrack.matrix).map(
      (n, i) => n / (i % 3 === 2 ? 2 ** 30 : 2 ** 16),
    ) as MuxerRotation

    const angle = Math.atan2(rotation[3], rotation[0]) * (180 / Math.PI)

    const audioTrack = mute ? undefined : audioTracks[0]

    return { videoTrack, audioTrack, rotation, angle }
  }

  async createFrameExtractor(demuxer: Demuxer, videoInfo: VideoMetadata) {
    const { rotation: angle } = this
    const options = { ...this.options, videoInfo, angle }
    let extractor

    try {
      if (IS_SAFARI && IS_LIKE_MAC) throw new Error('Broken VideoDecoder implementation?')
      extractor = new VideoDecoderExtractor(demuxer, options)
      await extractor.init()
    } catch {
      extractor = new RvfcExtractor(options)
      await extractor.init(this.url, options.crossOrigin)
    }

    this.janitor!.add(() => extractor.stop())

    return extractor
  }

  async createVideoEncoder(
    extractor: FrameExtractor,
    muxer: mp4Muxer.Muxer<any> | webmMuxer.Muxer<any>,
    onError: (error: unknown) => void,
  ) {
    const { options } = this
    const endTimeUs = options.end * 1_000_000
    const { codedWidth, codedHeight } = extractor.videoInfo
    const { bitrate = 1e8 } = options.videoEncoderConfig ?? {}

    const config: VideoEncoderConfig = {
      codec: this.videoOutCodec,
      width: codedWidth,
      height: codedHeight,
      bitrate,
      framerate: extractor.fps,
    }

    await assertEncoderConfigIsSupported('video', config)

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta, chunk.timestamp - extractor.firstFrameTimeUs)
        options.onProgress?.(chunk.timestamp / endTimeUs)
      },
      error: (error) => {
        onError(error)
      },
    })

    encoder.configure(config)

    this.janitor!.add(() => encoder.state === 'configured' && encoder.close())

    return encoder
  }

  setAudioRemuxing(
    demuxer: Demuxer,
    muxer: mp4Muxer.Muxer<mp4Muxer.ArrayBufferTarget> | webmMuxer.Muxer<webmMuxer.ArrayBufferTarget>,
    audio: AudioMetadata,
    { resolve, reject }: PromiseResolvers,
  ) {
    const startTimeUs = this.options.start * 1e6
    const endTimeUs = this.options.end * 1e6

    let firstAudioChunkTimestamp = -1

    const { codec, sampleRate, numberOfChannels, description } = audio
    const meta: EncodedAudioChunkMetadata = {
      decoderConfig: { codec, sampleRate, numberOfChannels, description },
    }

    demuxer.setExtractionOptions(
      audio,
      (chunk: MediaChunk) => {
        const { timestamp } = chunk
        if (timestamp < startTimeUs || timestamp >= endTimeUs) return
        if (firstAudioChunkTimestamp === -1) firstAudioChunkTimestamp = timestamp

        try {
          const uint8 = new Uint8Array(chunk.data)
          const trimmedTimestamp = timestamp - firstAudioChunkTimestamp

          if (muxer instanceof mp4Muxer.Muxer)
            muxer.addAudioChunkRaw(uint8, chunk.type, trimmedTimestamp, chunk.duration!)
          else muxer.addAudioChunkRaw(uint8, chunk.type, trimmedTimestamp, meta)
        } catch (error) {
          reject(error)
        }
      },
      resolve,
    )
  }

  dispose() {
    this.janitor?.dispose()
  }
}
