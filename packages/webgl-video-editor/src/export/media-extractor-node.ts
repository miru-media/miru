import { ref } from 'fine-jsx'
import { type RenderGraph } from 'videocontext'

import {
  type AudioBufferData,
  AudioDecoderTransform,
  VideoDecoderTransform,
} from 'shared/video/coder-transforms'
import { type EncodedMediaChunk } from 'shared/video/types'

import { type CustomSourceNodeOptions } from '../../types/internal'
import { CustomSourceNode } from '../video-context-nodes'

export interface ExtractorNodeOptions extends CustomSourceNodeOptions {
  targetFrameRate: number
}

export namespace MediaExtractorNode {
  export interface AudioInit {
    config: AudioDecoderConfig
    getStream: () => ReadableStream<EncodedMediaChunk>
    audioBuffer?: AudioBuffer
  }
  export interface VideoInit {
    config: VideoDecoderConfig & { codedWidth: number; codedHeight: number }
    getStream: () => ReadableStream<EncodedMediaChunk>
  }
}

export class MediaExtractorNode extends CustomSourceNode {
  videoIsReady = false

  audioInit?: MediaExtractorNode.AudioInit
  videoInit?: MediaExtractorNode.VideoInit

  videoStream?: VideoDecoderTransform
  audioStream?: AudioDecoderTransform
  decoderRange!: { start: number; end: number }
  videoReader?: ReadableStreamDefaultReader<VideoFrame>
  audioReader?: ReadableStreamDefaultReader<AudioBufferData>
  targetFrameDurationUs: number

  everHadEnoughData = false
  mediaTime = ref(0)

  currentVideoFrame?: VideoFrame
  currentAudioData?: AudioBufferData

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
    this._displayName = 'MediaExtractorNode'
    this.targetFrameDurationUs = 1e6 / options.targetFrameRate
  }

  init({ audio, video }: { audio?: MediaExtractorNode.AudioInit; video?: MediaExtractorNode.VideoInit }) {
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
    this.decoderRange = { start, end }

    this.everHadEnoughData = true
  }

  async seekVideo(timeS: number): Promise<boolean> {
    this.videoIsReady = true
    this._seek(timeS)

    if (!this.videoInit) return false

    const { presentationTime } = this

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.media = undefined
      return false
    }

    const sourceTimeUs = this.expectedMediaTime.value * 1e6

    if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
      return true
    }

    this.videoIsReady = false

    if (!this.currentVideoFrame) if (await this.readNextVideoFrame()) return false

    while (this.currentVideoFrame) {
      if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
        this.media = this.currentVideoFrame
        this.videoIsReady = true
        return true
      }

      if (await this.readNextVideoFrame()) break
    }

    return false
  }

  async readNextVideoFrame() {
    if (!this.videoReader) {
      const { config, getStream } = this.videoInit!
      this.videoStream = new VideoDecoderTransform({ config, ...this.decoderRange })
      this.videoReader = getStream().pipeThrough(this.videoStream).getReader()
    }

    this.currentVideoFrame?.close()
    const { done, value } = await this.videoReader.read()
    this.currentVideoFrame = this.media = value

    return done
  }

  async seekAudio(timeS: number): Promise<boolean> {
    if (!this.audioInit) return false

    const { playableTime } = this

    if (timeS < playableTime.start || timeS >= playableTime.end) return false

    const sourceTimeUs = (timeS - playableTime.start + playableTime.source) * 1e6

    if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true

    if (!this.currentAudioData) if (await this.readNextAudio()) return false

    while (this.currentAudioData) {
      // if the current data starts after the seek time, stop seeking
      if (this.currentAudioData.timestamp > timeS * 1e6) return true

      if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true
      if (await this.readNextAudio()) break
    }

    return false
  }

  async readNextAudio() {
    const audioBuffer = this.audioInit?.audioBuffer
    if (audioBuffer) {
      if (this.currentAudioData) {
        this.currentAudioData = undefined
        return false
      }

      this.currentAudioData = {
        timestamp: 0,
        duration: audioBuffer.duration * 1e6,
        buffer: audioBuffer,
      }
      return true
    }
    if (!this.audioReader) {
      const { config, getStream } = this.audioInit!
      this.audioStream = new AudioDecoderTransform({ config, ...this.decoderRange })
      this.audioReader = getStream().pipeThrough(this.audioStream).getReader()
    }

    const { done, value } = await this.audioReader.read()
    this.currentAudioData = value

    return done
  }

  #hasVideoFrameAtTimeUs(sourceTimeUs: number) {
    const frame = this.currentVideoFrame
    if (!frame) return false

    const frameCenter = frame.timestamp + frame.duration! / 2
    const targetFrameCenter = sourceTimeUs + this.targetFrameDurationUs / 2
    return frameCenter >= targetFrameCenter - 10 || frame.timestamp + frame.duration! >= sourceTimeUs
  }

  #hasAudioFrameAtTimeUs(sourceTimeUs: number) {
    const data = this.currentAudioData
    if (!data) return false
    return data.timestamp <= sourceTimeUs && sourceTimeUs < data.timestamp + data.duration
  }

  _play() {
    // noop
  }
  _pause() {
    // noop
  }

  getTextureImageSource() {
    return this.media as VideoFrame
  }

  closeTextureImageSource() {
    // noop
  }

  destroy() {
    this.videoStream?.dispose()
    this.audioStream?.dispose()

    this.currentVideoFrame?.close()

    super.destroy()
  }
}
