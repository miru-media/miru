import { IS_LIKE_MAC, IS_SAFARI } from '@/constants'
import { Janitor, promiseWithResolvers } from '@/utils'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

import {
  type DemuxerChunkInfo,
  type MP4BoxAudioTrack,
  type MP4BoxFileInfo,
  type MP4BoxVideoTrack,
  MP4Demuxer,
} from './demuxer'
import { type FrameExtractor } from './FrameExtractor'
import { RvfcExtractor } from './RvfcExtractor'
import { type TrimOptions } from './trim'
import { assertHasRequiredApis } from './utils'
import { VideoDecoderExtractor } from './VideoDecoderExtractor'

type MuxerRotation = [number, number, number, number, number, number, number, number, number]

interface PromiseResolvers {
  resolve: () => void
  reject: (reason: unknown) => void
}

export namespace Trimmer {}

export class Trimmer {
  url: string
  options: TrimOptions
  angle!: number
  janitor?: Janitor

  constructor(url: string, options: TrimOptions) {
    this.url = url
    this.options = options
  }

  async trim() {
    const { onProgress } = this.options
    onProgress?.(0)
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

    const { demuxer, mp4Info } = await this.initDemuxer(abort)
    const { videoTrack, audioTrack, rotation, angle } = this.getTracks(mp4Info)
    this.angle = angle
    const frameExtractor = await this.createFrameExtractor(demuxer, videoTrack)

    const { width, height } = videoTrack.video
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
        rotation,
      },
      audio: audioTrack && {
        codec: 'aac',
        sampleRate: audioTrack.audio.sample_rate,
        numberOfChannels: audioTrack.audio.channel_count,
      },
      fastStart: options.fastStart ?? false,
    })

    const videoEncoder = this.createVideoEncoder(frameExtractor, muxer, (error) => abort.abort(error))

    frameExtractor.start((frame, trimmedTimestamp) => {
      if (videoEncoder.state !== 'configured') {
        frame.close()
        return
      }

      if (trimmedTimestamp >= 0) videoEncoder.encode(frame)

      frame.close()
    }, abort.signal)

    const audioRemuxPromise = promiseWithResolvers()
    if (audioTrack) {
      this.setAudioRemuxing(demuxer, muxer, audioTrack, {
        resolve: audioRemuxPromise.resolve,
        reject: (error) => {
          audioRemuxPromise.reject(error)
          abort.abort(error)
        },
      })
    } else audioRemuxPromise.resolve()

    demuxer.start(options.start, options.end)
    await demuxer.flush()
    await frameExtractor.flush()
    await Promise.all([videoEncoder.flush(), audioRemuxPromise.promise])

    muxer.finalize()
    done = true

    const { buffer } = muxer.target
    return new Blob([buffer], { type: 'video/mp4' })
  }

  async initDemuxer(abort: AbortController) {
    const { credentials } = this.options

    const demuxer = new MP4Demuxer()
    const mp4Info = await demuxer.init(this.url, {
      credentials,
      signal: abort.signal,
    })

    this.janitor!.add(() => demuxer.stop())
    return { demuxer, mp4Info }
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

  async createFrameExtractor(demuxer: MP4Demuxer, track: MP4BoxVideoTrack) {
    const { angle } = this
    const options = { ...this.options, track, angle }
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

  createVideoEncoder(extractor: FrameExtractor, muxer: Muxer<any>, onError: (error: unknown) => void) {
    const { options } = this
    const endTimeUs = options.end * 1_000_000
    const { width, height } = extractor.track.video
    const MAX_AREA_LEVEL_30 = 1280 * 720
    const {
      codec = `avc1.4200${(width * height > MAX_AREA_LEVEL_30 ? 40 : 31).toString(16)}`,
      bitrate = 1e6,
    } = options.encoderConfig ?? {}

    const config: VideoEncoderConfig = { codec, width, height, framerate: extractor.fps, bitrate }

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta, chunk.timestamp - extractor.firstFrameTimestamp)
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
    demuxer: MP4Demuxer,
    muxer: Muxer<ArrayBufferTarget>,
    audioTrack: MP4BoxAudioTrack,
    { resolve, reject }: PromiseResolvers,
  ) {
    const startTimeUs = this.options.start * 1_000_000
    let firstAudioChunkTimestamp = -1

    demuxer.setExtractionOptions(
      audioTrack,
      (chunk: DemuxerChunkInfo) => {
        const { timestamp } = chunk
        if (timestamp < startTimeUs) return
        if (firstAudioChunkTimestamp === -1) firstAudioChunkTimestamp = timestamp

        try {
          muxer.addAudioChunkRaw(
            new Uint8Array(chunk.data),
            chunk.type,
            timestamp - firstAudioChunkTimestamp,
            chunk.duration,
          )
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
