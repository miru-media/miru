import { effect, ref } from 'fine-jsx'
import * as Mb from 'mediabunny'

import type { AudioBufferData } from 'shared/video/coder-transforms'

import type * as pub from '../../../types/core.d.ts'
import type { VideoEffectAsset } from '../../assets/video-effect-asset.ts'
import { NodeView } from '../node-view.ts'

import type { ExportDocument } from './exporter-document.ts'

export class ExportMediaClip extends NodeView<ExportDocument, pub.AnyMediaClip> {
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

  constructor(exportView: ExportDocument, original: pub.AnyMediaClip) {
    super(exportView, original)

    this.targetFrameDurationUs = 1e6 / exportView.doc.frameRate
  }

  init(): void {
    const exporter = this.docView
    const { audio, video, audioBuffer } = exporter.sources.get(this.original.asset!.id)!
    const { playableTime, time: clipTime } = this.original
    const start = playableTime.source + Math.max(0, exporter.range.start - clipTime.start)
    const end = playableTime.source + playableTime.duration + Math.max(0, exporter.range.end - clipTime.end)

    if (start < 0 || end < start) return

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
      const onAbort = (): void => {
        stop()
        reject(new Error('aborted', { cause: signal.reason }))
      }
      signal.addEventListener('abort', onAbort)

      const stop = effect(() => {
        if (!this.isReady) return
        stop()
        resolve()
        signal.removeEventListener('abort', onAbort)
      })
    })
  }

  async seekVideo(): Promise<void> {
    this.videoIsReady = true

    if (!this.video) return

    this.renderClip!.sprite.visible = this.original.isInClipTime

    const sourceTimeUs = this.original.expectedMediaTime * 1e6

    if (this.#hasCurrentVideoFrame(sourceTimeUs)) return

    this.videoIsReady = false

    if (!this.currentVideoFrame) if (await this.readNextVideoFrame()) return

    while (this.currentVideoFrame) {
      if (this.#hasCurrentVideoFrame(sourceTimeUs)) {
        this.videoIsReady = true
        break
      }

      // eslint-disable-next-line no-await-in-loop -- TODO: use async iterator
      if (await this.readNextVideoFrame()) break
    }
  }

  /** @returns `true` if the sample iterator is done */
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

  #hasCurrentVideoFrame(sourceTimeUs: number): boolean {
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

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isExportMediaClip(): this is ExportMediaClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  updateVisibility(): void {
    updateVisibility(this)
  }

  dispose(): void {
    void this.audioSamples?.return(null)
    void this.videoSamples?.return(null)
    this.currentVideoFrame?.close()
  }
}

export class ExportNonMediaVideoClip extends NodeView<ExportDocument, pub.AnyVideoClip> {
  renderClip = this.docView.renderView._getNode(this.original)

  get isReady(): boolean {
    return this.original.isReady
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  init(): void {
    // stub
  }

  whenReady(): void {
    throw new Error('TODO: load font asset')
  }

  isExportMediaClip(): this is ExportMediaClip {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  updateVisibility(): void {
    updateVisibility(this)
  }
}

const updateVisibility = (exportClip: ExportMediaClip | ExportNonMediaVideoClip) => {
  const { renderClip } = exportClip
  if (!renderClip) return

  if (exportClip.original.isInClipTime) renderClip.pixiNode.visible ||= true
  else renderClip.pixiNode.visible &&= false
}
