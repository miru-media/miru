import { ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import {
  type AudioBufferData,
  AudioDecoderTransform,
  VideoDecoderTransform,
} from 'shared/video/coder-transforms'
import type { EncodedMediaChunk } from 'shared/video/types'

import type { CustomSourceNodeOptions } from '../../types/internal'

import type { ExporterClip } from './exporter-clip.ts'

export interface ExtractorNodeOptions extends CustomSourceNodeOptions {
  targetFrameRate: number
}

export namespace MediaExtractor {
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

export class MediaExtractor {
  clip: ExporterClip
  media?: TexImageSource | HTMLAudioElement
  videoIsReady = false

  audioInit?: MediaExtractor.AudioInit
  videoInit?: MediaExtractor.VideoInit

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
  sprite?: Pixi.Sprite

  constructor(clip: ExporterClip) {
    this.clip = clip
    this.targetFrameDurationUs = 1e6 / clip.root.frameRate
    clip.onDispose(this.dispose.bind(this))
  }

  init({ audio, video }: { audio?: MediaExtractor.AudioInit; video?: MediaExtractor.VideoInit }) {
    if (audio) this.audioInit = audio
    if (video) {
      this.videoInit = video

      const { mediaSize } = this.clip
      const sprite = (this.sprite = new Pixi.Sprite(
        new Pixi.Texture({ source: new Pixi.ImageSource(mediaSize) }),
      ))
      sprite.visible = false

      this.clip.resizeSprite(sprite)
      this.clip.parent!.container.addChild(sprite)
    }

    const { playableTime } = this.clip
    const start = playableTime.source
    const end = start + playableTime.duration
    this.decoderRange = { start, end }

    this.everHadEnoughData = true
  }

  async seekVideo(): Promise<boolean> {
    this.videoIsReady = true

    const { clip } = this
    const timeS = clip.root.currentTime

    if (!this.videoInit) return false

    const { presentationTime } = clip

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.media = undefined
      this.sprite!.visible = false
      return false
    }

    const sourceTimeUs = clip.expectedMediaTime * 1e6

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

    if (value) {
      const textureSource = this.sprite!.texture.source
      textureSource.resource = value
      textureSource.update()
      this.sprite!.visible = true
    }

    return done
  }

  async seekAudio(timeS: number): Promise<boolean> {
    if (!this.audioInit) return false

    const { playableTime } = this.clip

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

  getTextureImageSource() {
    return this.media as VideoFrame
  }

  dispose() {
    this.videoStream?.dispose()
    this.audioStream?.dispose()

    this.currentVideoFrame?.close()
    this.sprite?.destroy()

    this.clip = undefined as never
  }
}
