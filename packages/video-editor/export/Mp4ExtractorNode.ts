import { ref } from 'fine-jsx'
import { type RenderGraph } from 'videocontext'

import { AudioDecoderStream, VideoDecoderStream } from 'shared/transcode/DecoderStream'
import { type DemuxerChunkInfo } from 'shared/transcode/demuxer'

import { type CustomSourceNodeOptions } from '../types'
import { CustomSourceNode } from '../videoContextNodes'

export interface ExtractorNodeOptions extends CustomSourceNodeOptions {
  targetFrameRate: number
}

export namespace Mp4ExtractorNode {
  export interface AudioInit {
    config: AudioDecoderConfig
    chunks: DemuxerChunkInfo[]
    audioBuffer?: AudioBuffer
  }
  export interface VideoInit {
    config: VideoDecoderConfig & { codedWidth: number; codedHeight: number }
    chunks: DemuxerChunkInfo[]
  }
}

export class Mp4ExtractorNode extends CustomSourceNode {
  videoIsReady = false

  audioInit?: Mp4ExtractorNode.AudioInit
  videoInit?: Mp4ExtractorNode.VideoInit

  videoStream?: VideoDecoderStream
  audioStream?: AudioDecoderStream
  streamInit!: { start: number; end: number; onError: (error: unknown) => void }
  targetFrameDurationUs: number

  everHadEnoughData = false
  mediaTime = ref(0)

  get currentVideoFrame() {
    return this.videoStream?.currentValue
  }
  get currentAudioData() {
    const audioBuffer = this.audioInit?.audioBuffer

    if (audioBuffer) return { timestamp: 0, duration: audioBuffer.duration * 1e6, buffer: audioBuffer }
    return this.audioStream?.currentValue
  }

  onError?: (error: unknown) => void

  _audioReady = false
  _isReady() {
    return this.videoIsReady
  }

  constructor(
    _src: undefined,
    gl: WebGL2RenderingContext,
    renderGraph: RenderGraph,
    currentTime: number,
    options: ExtractorNodeOptions,
  ) {
    super(gl, renderGraph, currentTime, options)
    this._displayName = 'Mp4ExtractorNode'
    this.targetFrameDurationUs = 1e6 / options.targetFrameRate
  }

  init({ audio, video }: { audio?: Mp4ExtractorNode.AudioInit; video?: Mp4ExtractorNode.VideoInit }) {
    if (audio) this.audioInit = audio
    if (video) {
      const { codedWidth, codedHeight } = video.config

      this.videoInit = video
      const rotation = this.source.video?.rotation ?? 0
      ;[this.mediaSize.width, this.mediaSize.height] =
        rotation % 180 ? [codedHeight, codedWidth] : [codedWidth, codedHeight]
    }

    const { playableTime } = this
    const start = playableTime.source
    const end = start + playableTime.duration
    const onError = (error: unknown) => this.onError?.(error)
    this.streamInit = { start, end, onError }

    this.everHadEnoughData = true
  }

  async seekVideo(timeS: number): Promise<boolean> {
    this.videoIsReady = true
    this._seek(timeS)

    if (!this.videoInit || this.videoStream?.doneReading) return false

    const { presentationTime } = this

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.media = undefined
      return false
    }

    const sourceTimeUs = this.expectedMediaTime.value * 1e6

    if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
      this.media = this.currentVideoFrame
      return true
    }

    this.videoIsReady = false

    if (!this.videoStream) {
      const { chunks, config } = this.videoInit
      this.videoStream = await new VideoDecoderStream({ chunks, config, ...this.streamInit }).init()
    }

    if (!this.currentVideoFrame) await this.videoStream.read()

    while (this.currentVideoFrame) {
      if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
        this.media = this.currentVideoFrame
        this.videoIsReady = true
        return true
      }

      if (this.videoStream.doneReading) break

      await this.videoStream.read()
    }

    return false
  }

  async seekAudio(timeS: number): Promise<boolean> {
    if (!this.audioInit || (!this.audioInit.audioBuffer && this.audioStream?.doneReading)) return false

    const { playableTime } = this

    if (timeS < playableTime.start || timeS >= playableTime.end) return false
    if (this.audioInit.audioBuffer) return true

    const sourceTimeUs = (timeS - playableTime.start + playableTime.source) * 1e6

    if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true

    if (!this.audioStream) {
      const { chunks, config } = this.audioInit
      this.audioStream = await new AudioDecoderStream({ chunks, config, ...this.streamInit }).init()
    }

    if (!this.currentAudioData) await this.audioStream.read()

    while (this.currentAudioData) {
      if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true
      await this.audioStream.read()
    }
    return false
  }

  #hasVideoFrameAtTimeUs(sourceTimeUs: number) {
    const frame = this.videoStream?.currentValue
    if (!frame) return false

    const frameCenter = frame.timestamp + frame.duration! / 2
    const targetFrameCenter = sourceTimeUs + this.targetFrameDurationUs / 2
    return frameCenter >= targetFrameCenter - 10 || frame.timestamp + frame.duration! >= sourceTimeUs
  }

  #hasAudioFrameAtTimeUs(sourceTimeUs: number) {
    const data = this.audioStream?.currentValue
    if (!data) return false
    return data.timestamp <= sourceTimeUs && sourceTimeUs < data.timestamp + data.duration
  }

  _play() {
    // noop
  }
  _pause() {
    // noop
  }

  destroy() {
    this.videoStream?.dispose()
    this.audioStream?.dispose()

    super.destroy()
  }
}
