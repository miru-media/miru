import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

import { IS_LIKE_MAC, IS_SAFARI } from 'shared/userAgent'
import { Janitor, promiseWithResolvers } from 'shared/utils'
import {
  type DemuxerAudioInfo,
  type DemuxerChunkInfo,
  type DemuxerVideoInfo,
  type MP4BoxFileInfo,
  type MP4BoxVideoTrack,
  MP4Demuxer,
} from 'shared/video/demuxer'
import { type FrameExtractor } from 'shared/video/FrameExtractor'
import { RvfcExtractor } from 'shared/video/RvfcExtractor'
import { assertEncoderConfigIsSupported } from 'shared/video/utils'
import { VideoDecoderExtractor } from 'shared/video/VideoDecoderExtractor'

import { type TrimOptions } from './types/media-trimmer'
import { assertHasRequiredApis } from './utils'

type MuxerRotation = [number, number, number, number, number, number, number, number, number]

interface PromiseResolvers {
  resolve: () => void
  reject: (reason: unknown) => void
}

export class Trimmer {
  url: string
  options: TrimOptions
  rotation!: number
  janitor?: Janitor

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

    const { demuxer, mp4Info } = await this.initDemuxer(abort)
    const { video, audio } = mp4Info
    this.rotation = video?.rotation ?? 0
    const frameExtractor = await this.createFrameExtractor(demuxer, video!)

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: video && {
        codec: 'avc',
        width: video.codedWidth,
        height: video.codedHeight,
        rotation: video.matrix,
      },
      audio: audio && {
        codec: 'aac',
        sampleRate: audio.sampleRate,
        numberOfChannels: audio.numberOfChannels,
      },
      fastStart: 'in-memory',
    })

    const videoEncoder = await this.createVideoEncoder(frameExtractor, muxer, (error) => abort.abort(error))

    frameExtractor.start((frame, trimmedTimestamp) => {
      if (videoEncoder.state === 'configured' && trimmedTimestamp >= 0) videoEncoder.encode(frame)
      frame.close()
    }, abort.signal)

    const audioRemuxPromise = promiseWithResolvers()
    if (audio) {
      this.setAudioRemuxing(demuxer, muxer, audio, {
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

  async createFrameExtractor(demuxer: MP4Demuxer, videoInfo: DemuxerVideoInfo) {
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

  async createVideoEncoder(extractor: FrameExtractor, muxer: Muxer<any>, onError: (error: unknown) => void) {
    const { options } = this
    const endTimeUs = options.end * 1_000_000
    const { codedWidth, codedHeight } = extractor.videoInfo
    const MAX_AREA_LEVEL_30 = 1280 * 720
    const {
      codec = `avc1.4200${(codedWidth * codedHeight > MAX_AREA_LEVEL_30 ? 40 : 31).toString(16)}`,
      bitrate = 1e6,
    } = options.encoderConfig ?? {}

    const config: VideoEncoderConfig = {
      codec,
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
    demuxer: MP4Demuxer,
    muxer: Muxer<ArrayBufferTarget>,
    audio: DemuxerAudioInfo,
    { resolve, reject }: PromiseResolvers,
  ) {
    const startTimeUs = this.options.start * 1_000_000
    let firstAudioChunkTimestamp = -1

    demuxer.setExtractionOptions(
      audio.track,
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
