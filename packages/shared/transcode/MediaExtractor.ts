import {
  type DemuxerChunkInfo,
  type MP4BoxAudioTrack,
  type MP4BoxFileInfo,
  type MP4BoxVideoTrack,
  MP4Demuxer,
} from 'shared/transcode/demuxer'
import { RvfcExtractor } from 'shared/transcode/RvfcExtractor'
import { VideoDecoderExtractor } from 'shared/transcode/VideoDecoderExtractor'

import { IS_LIKE_MAC, IS_SAFARI } from '../userAgent'
import { Janitor } from '../utils'

import { assertCanExtractVideoFrames } from './utils'

type MuxerRotation = [number, number, number, number, number, number, number, number, number]

interface Options {
  start: number
  end: number
  mute?: boolean
  credentials?: RequestCredentials
  crossOrigin?: 'anonymous' | 'use-credentials' | null
}

export class MediaExtractor extends ReadableStream<VideoFrame | DemuxerChunkInfo> {
  url: string
  options: Options
  angle!: number
  janitor?: Janitor
  abort?: AbortController
  demuxer!: MP4Demuxer
  mp4Info!: MP4BoxFileInfo
  videoTrack!: MP4BoxVideoTrack
  audioTrack: MP4BoxAudioTrack | undefined
  rotation!: MuxerRotation
  frameExtractor!: VideoDecoderExtractor | RvfcExtractor
  done = false
  _controller!: ReadableStreamDefaultController<VideoFrame | DemuxerChunkInfo>

  constructor(url: string, options: Options) {
    let _controller!: ReadableStreamDefaultController<VideoFrame | DemuxerChunkInfo>

    super(
      {
        start: (controller) => (_controller = controller),
        cancel: () => this.dispose(),
      },
      new CountQueuingStrategy({ highWaterMark: 20 }),
    )

    this.url = url
    this.options = options
    this._controller = _controller
  }

  async init() {
    assertCanExtractVideoFrames()
    const janitor = (this.janitor = new Janitor())
    const abort = (this.abort = new AbortController())

    janitor.add(() => !this.done && abort.abort())

    const { demuxer, mp4Info } = await this.initDemuxer(abort)
    const { videoTrack, audioTrack, rotation, angle } = this.getTracks(mp4Info)
    this.angle = angle
    const frameExtractor = await this.createFrameExtractor(demuxer, videoTrack)

    this.demuxer = demuxer
    this.mp4Info = mp4Info
    this.videoTrack = videoTrack
    this.audioTrack = audioTrack
    this.rotation = rotation
    this.angle = angle
    this.frameExtractor = frameExtractor
  }

  async start(signal?: AbortSignal) {
    const { start, end } = this.options
    const { demuxer, frameExtractor } = this

    signal?.addEventListener('abort', () => this.abort?.abort(), { once: true })

    frameExtractor.start((frame, trimmedTimestamp) => {
      if (trimmedTimestamp >= 0) this._controller.enqueue(frame)
    }, signal)

    demuxer.start(start, end)

    await demuxer.flush()
    await frameExtractor.flush()

    this.done = true
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

  dispose() {
    this.janitor?.dispose()
  }
}
