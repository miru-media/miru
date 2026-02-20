import { ref } from 'fine-jsx'
import * as Mb from 'mediabunny'
import * as Pixi from 'pixi.js'

import type { AudioBufferData } from 'shared/video/coder-transforms'

import type { MediaAsset, VideoEffectAsset } from '../assets.ts'
import { BaseClip } from '../nodes/base-clip.ts'
import type { Schema, Track } from '../nodes/index.ts'
import { MiruFilter } from '../pixi/pixi-miru-filter.ts'

export namespace ExporterClip {
  export interface InitOptions {
    video: Mb.InputVideoTrack | null
    audio: Mb.InputAudioTrack | null
    audioBuffer?: AudioBuffer
  }
}

export class ExporterClip extends BaseClip {
  readonly videoEffect: VideoEffectAsset | undefined
  readonly #filterIntensity = ref(1)
  sourceAsset: MediaAsset
  source: Schema.Clip['source']

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

  #miruFilters?: MiruFilter[]

  get filter(): BaseClip['filter'] {
    const effect = this.videoEffect
    return effect && { assetId: effect.id, intensity: this.#filterIntensity.value }
  }

  get isReady(): boolean {
    return this.videoIsReady && !this.videoEffect?.isLoading && !this.#miruFilters?.some((f) => f.isLoading)
  }
  get everHadEnoughData(): boolean {
    return this.isReady
  }

  constructor(init: Schema.Clip, track: Track) {
    super(init, track.root)

    const { root } = this

    this.source = init.source
    this.sourceAsset = root.assets.get(init.source.assetId) as MediaAsset
    this.videoEffect = init.filter && (root.assets.get(init.filter.assetId) as VideoEffectAsset)
    this.#filterIntensity.value = init.filter?.intensity ?? 1
    this.transition = init.transition

    this.targetFrameDurationUs = 1e6 / root.frameRate

    this.onDispose(() => {
      void this.audioSamples?.return(null)
      void this.videoSamples?.return(null)
      this.currentVideoFrame?.close()
    })
  }

  resizeSprite(sprite: Pixi.Sprite): void {
    super.resizeSprite(sprite, true)
  }

  init(options: ExporterClip.InitOptions): void {
    this.scope.run(() => this.#init(options))
  }

  #init({ audio, video, audioBuffer }: ExporterClip.InitOptions): void {
    const { playableTime } = this
    const start = playableTime.source
    const end = start + playableTime.duration

    this.audio = audio
    this.video = video

    if (audioBuffer) this.audioBuffer = audioBuffer
    else if (audio) {
      this.audioSamples = new Mb.AudioSampleSink(audio).samples(start, end)
    }

    if (video) {
      this.videoSamples = new Mb.VideoSampleSink(video).samples(start, end)

      const { mediaSize, filter, root } = this
      const sprite = (this.sprite = new Pixi.Sprite(
        new Pixi.Texture({ source: new Pixi.ImageSource(mediaSize) }),
      ))
      sprite.visible = false

      this.resizeSprite(sprite)
      this.parent!.container.addChild(sprite)

      if (filter) {
        const filterAsset = root.assets.get(filter.assetId) as VideoEffectAsset
        this.#miruFilters = sprite.filters = filterAsset.ops.map(
          (op) => new MiruFilter(op, ref(filter.intensity)),
        )

        this.#miruFilters.forEach((filter) => filter.sprites.forEach((sprite) => root.stage.addChild(sprite)))
      }
    }
  }

  async seekVideo(): Promise<boolean> {
    this.videoIsReady = true

    const timeS = this.root.currentTime

    if (!this.video) return false

    const { presentationTime } = this

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.sprite!.visible = false
      return false
    }

    const sourceTimeUs = this.expectedMediaTime * 1e6

    if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) return true

    this.videoIsReady = false

    if (!this.currentVideoFrame) if (await this.readNextVideoFrame()) return false

    while (this.currentVideoFrame) {
      if (this.#hasVideoFrameAtTimeUs(sourceTimeUs)) {
        this.videoIsReady = true
        return true
      }

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
      const sprite = this.sprite!
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

  /* eslint-disable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function -- stubs */
  connect(): void {}
  disconnect(): void {}
  /* eslint-enable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function */
}
