import { effect, ref } from 'fine-jsx'
import * as Mb from 'mediabunny'

import type { AudioBufferData } from 'shared/video/coder-transforms'

import type * as pub from '../../../types/core.d.ts'
import type { VideoEffectAsset } from '../../assets/video-effect-asset.ts'
import { NodeView } from '../node-view.ts'

import type { ExportDocument } from './exporter-document.ts'

export interface InitOptions {
  video: Mb.InputVideoTrack | null
  audio: Mb.InputAudioTrack | null
  audioBuffer?: AudioBuffer
}

export class ExportClip extends NodeView<ExportDocument, pub.AnyClip> {
  renderClip = this.docView.renderView._getNode(this.original)
  readonly videoEffect: VideoEffectAsset | undefined

  declare translate: { x: number; y: number }
  declare rotate: number
  declare scale: { x: number; y: number }
  declare volume: number
  declare mute: boolean

  videoIsReady = false

  audio!: Mb.InputAudioTrack | null
  video!: Mb.InputVideoTrack | null

  videoSamples?: AsyncGenerator<Mb.VideoSample>
  audioSamples?: AsyncGenerator<Mb.AudioSample>
  targetFrameDurationUs: number

  mediaTime = ref(0)

  currentVideoFrame?: VideoFrame
  currentAudioData?: AudioBufferData
  audioBuffer?: AudioBuffer

  get isReady(): boolean {
    return this.original.isReady && this.videoIsReady && this.renderClip?.isReady.value !== false
  }

  constructor(exportView: ExportDocument, original: pub.AnyClip) {
    super(exportView, original)

    this.targetFrameDurationUs = 1e6 / exportView.doc.frameRate
  }

  init({ audio, video, audioBuffer }: InitOptions): void {
    const { playableTime } = this.original
    const start = playableTime.source
    const end = start + playableTime.duration

    this.audio = audio
    this.video = video

    if (audioBuffer) this.audioBuffer = audioBuffer
    else if (audio) this.audioSamples = new Mb.AudioSampleSink(audio).samples(start, end)

    if (video) {
      this.videoSamples = new Mb.VideoSampleSink(video).samples(start, end)
    }
  }

  async whenReady(signal: AbortSignal): Promise<void> {
    if (this.isReady) return

    await new Promise<void>((resolve, reject) => {
      signal.addEventListener('abort', () => {
        stop()
        reject(new Error('aborted', { cause: signal.reason }))
      })

      const stop = effect(() => {
        if (!this.isReady) return
        stop()
        resolve()
      })
    })
  }

  async seekVideo(): Promise<boolean> {
    this.videoIsReady = true

    const timeS = this.docView.doc.currentTime

    if (!this.video) return false

    const { presentationTime } = this.original

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.renderClip!.sprite.visible = false
      return false
    }

    const sourceTimeUs = this.original.expectedMediaTime * 1e6

    if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) return true

    this.videoIsReady = false

    if (!this.currentVideoFrame) if (await this.readNextVideoFrame()) return false

    while (this.currentVideoFrame) {
      if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
        this.videoIsReady = true
        return true
      }

      // eslint-disable-next-line no-await-in-loop -- TODO: use async iterator
      if (await this.readNextVideoFrame()) break
    }

    return false
  }

  async readNextVideoFrame(): Promise<boolean> {
    this.currentVideoFrame?.close()
    const next = await this.videoSamples!.next()

    if (next.done) {
      this.currentVideoFrame = undefined
    } else {
      const sample = next.value
      const { sprite } = this.renderClip!
      const textureSource = sprite.texture.source
      textureSource.resource = this.currentVideoFrame = sample.toVideoFrame()
      textureSource.update()
      sprite.visible = true
      sample.close()
    }

    return !!next.done
  }

  async seekAudio(timeS: number): Promise<boolean> {
    if (!this.audio) return false

    const { playableTime } = this.original

    if (timeS < playableTime.start || timeS >= playableTime.end) return false

    const sourceTimeUs = (timeS - playableTime.start + playableTime.source) * 1e6

    if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true

    if (!this.currentAudioData) if (await this.readNextAudio()) return false

    while (this.currentAudioData) {
      // if the current data starts after the seek time, stop seeking
      if (this.currentAudioData.timestamp > timeS * 1e6) return true

      if (this.#hasAudioFrameAtTimeUs(sourceTimeUs)) return true
      // eslint-disable-next-line no-await-in-loop -- TODO: use async iterator
      if (await this.readNextAudio()) break
    }

    return false
  }

  async readNextAudio(): Promise<boolean> {
    if (this.audioBuffer) {
      if (this.currentAudioData) {
        this.currentAudioData = undefined
        return false
      }

      this.currentAudioData = {
        timestamp: 0,
        duration: this.audioBuffer.duration * 1e6,
        buffer: this.audioBuffer,
      }
      return true
    }

    const next = await this.audioSamples!.next()

    if (next.done) {
      this.currentAudioData = undefined
    } else {
      const sample = next.value
      const { timestamp, duration } = sample
      const buffer = sample.toAudioBuffer()
      this.currentAudioData = { timestamp: timestamp * 1e6, duration: duration * 1e6, buffer }
      sample.close()
    }

    return !!next.done
  }

  #hasVideoFrameAtTimeUs(sourceTimeUs: number): boolean {
    const frame = this.currentVideoFrame
    if (!frame) return false

    const frameCenter = frame.timestamp + frame.duration! / 2
    const targetFrameCenter = sourceTimeUs + this.targetFrameDurationUs / 2
    return frameCenter >= targetFrameCenter - 10 || frame.timestamp + frame.duration! >= sourceTimeUs
  }

  #hasAudioFrameAtTimeUs(sourceTimeUs: number): boolean {
    const data = this.currentAudioData
    if (!data) return false
    return data.timestamp <= sourceTimeUs && sourceTimeUs < data.timestamp + data.duration
  }

  dispose(): void {
    void this.audioSamples?.return(null)
    void this.videoSamples?.return(null)
    this.currentVideoFrame?.close()
  }
}
