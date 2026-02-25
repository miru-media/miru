import { ref } from 'fine-jsx'
import * as Mb from 'mediabunny'
import * as Pixi from 'pixi.js'

import type { AudioBufferData } from 'shared/video/coder-transforms'

import type * as pub from '../../types/core.d.ts'
import type { MediaAsset, VideoEffectAsset } from '../assets.ts'
import { BaseClip } from '../nodes/base-clip.ts'
import type { AudioClip, Schema, Track, VisualClip } from '../nodes/index.ts'
import { MiruFilter } from '../pixi/pixi-miru-filter.ts'
import { updateSpriteTransform } from '../utils.ts'

import type { ExporterDocument } from './exporter-document.ts'

export namespace ExporterClip {
  export interface InitOptions {
    video: Mb.InputVideoTrack | null
    audio: Mb.InputAudioTrack | null
    audioBuffer?: AudioBuffer
  }
}

export class ExporterClip
  extends BaseClip
  implements Omit<pub.VisualClip, 'clipType'>, Omit<pub.AudioClip, 'clipType'>
{
  declare container?: Pixi.Sprite
  declare clipType: 'video' | 'audio'
  readonly videoEffect: VideoEffectAsset | undefined
  readonly #filterIntensity = ref(1)
  sourceAsset: MediaAsset
  source: Schema.BaseClip['source']

  declare position: { x: number; y: number }
  declare rotation: number
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

  #miruFilters?: MiruFilter[]

  get sprite(): Pixi.Sprite | undefined {
    return this.container
  }

  get filter(): VisualClip['filter'] {
    const effect = this.videoEffect
    return effect && { assetId: effect.id, intensity: this.#filterIntensity.value }
  }

  get videoRotation(): number {
    return this.sourceAsset.video?.rotation ?? 0
  }

  get isReady(): boolean {
    return this.videoIsReady && !this.videoEffect?.isLoading && !this.#miruFilters?.some((f) => f.isLoading)
  }
  get everHadEnoughData(): boolean {
    return this.isReady
  }

  constructor(init: Schema.AnyClip, root: ExporterDocument) {
    super(init, root)

    this.source = init.source
    this.sourceAsset = root.assets.get(init.source.assetId) as MediaAsset

    if (init.clipType === 'video') {
      this.container = new Pixi.Sprite()
      this.videoEffect = init.filter && (root.assets.get(init.filter.assetId) as VideoEffectAsset)
      this.#filterIntensity.value = init.filter?.intensity ?? 1

      this.position = init.position ?? { x: 0, y: 0 }
      this.rotation = init.rotation ?? 0
      this.scale = init.scale ?? { x: 1, y: 1 }
    } else {
      this.volume = init.volume ?? 1
      this.mute = init.mute ?? false
    }

    this.transition = init.transition

    this.targetFrameDurationUs = 1e6 / root.frameRate

    this.onDispose(() => {
      void this.audioSamples?.return(null)
      void this.videoSamples?.return(null)
      this.currentVideoFrame?.close()
    })
  }

  isVisual(): this is VisualClip | Track {
    return !!this.parent?.isVisual()
  }
  isAudio(): this is AudioClip | Track {
    return !!this.parent?.isAudio()
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

      const { mediaSize, root } = this
      const sprite = (this.container = new Pixi.Sprite({
        texture: new Pixi.Texture({ source: new Pixi.ImageSource(mediaSize) }),
        visible: true,
        zIndex: this.index,
      }))

      if (this.isVisual()) {
        updateSpriteTransform(this)
        this.parent!.container.addChild(sprite)

        const { filter } = this

        if (filter) {
          const filterAsset = root.assets.get(filter.assetId) as VideoEffectAsset
          this.#miruFilters = sprite.filters = filterAsset.ops.map(
            (op) => new MiruFilter(op, ref(filter.intensity)),
          )

          this.#miruFilters.forEach((filter) =>
            filter.sprites.forEach((sprite) => root.stage.addChild(sprite)),
          )
        }
      }
    }
  }

  async seekVideo(): Promise<boolean> {
    this.videoIsReady = true

    const timeS = this.root.currentTime

    if (!this.video) return false

    const { presentationTime } = this

    if (timeS < presentationTime.start || timeS >= presentationTime.end) {
      this.container!.visible = false
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
      const sprite = this.container!
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
