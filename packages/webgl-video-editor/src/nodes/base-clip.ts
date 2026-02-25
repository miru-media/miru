import { computed, createEffectScope, effect, type EffectScope, type Ref } from 'fine-jsx'

import type { Size } from 'shared/types.ts'
import { clamp } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import type { ClipTime } from '../../types/core.ts'
import type { AnyClip, RootNode } from '../../types/internal'
import type { MediaAsset } from '../assets.ts'
import { TRANSITION_DURATION_S, VIDEO_PREPLAY_TIME_S } from '../constants.ts'

import type { Schema } from './index.ts'
import { TrackChild } from './track-child.ts'

export abstract class BaseClip<T extends Schema.BaseClip = Schema.AnyClip> extends TrackChild<T> {
  abstract sourceAsset: MediaAsset
  abstract isReady: boolean
  abstract everHadEnoughData: boolean
  declare readonly type: 'clip'
  abstract clipType: T['clipType']

  declare root: RootNode
  declare children: undefined
  declare name: string

  declare abstract source: Schema.BaseClip['source']
  declare sourceStart: Schema.BaseClip['sourceStart']
  declare duration: Schema.BaseClip['duration']
  declare transition: Schema.BaseClip['transition']

  declare scope: EffectScope
  declare private _time: Ref<ClipTime>

  readonly #presentationTime = computed((): ClipTime => {
    const { time } = this
    const inTransitionDuration = this.prev?.transition ? TRANSITION_DURATION_S : 0

    const start = time.start - inTransitionDuration
    const source = time.source - inTransitionDuration
    const duration = time.duration + inTransitionDuration

    return { start, source, duration, end: start + duration }
  })
  readonly #playableTime = computed((): ClipTime => {
    const presentation = this.#presentationTime.value
    if (presentation.source >= 0) return presentation

    const { start, end, source, duration } = presentation
    const preplayDuration = Math.max(0, start - Math.min(VIDEO_PREPLAY_TIME_S, source))

    return {
      start: start - preplayDuration,
      source: source - preplayDuration,
      duration: duration + preplayDuration,
      end,
    }
  })
  readonly #expectedMediaTime = computed((): number => {
    const { start, source, duration } = this.playableTime
    return clamp(this.root.currentTime - start + source, source, source + duration)
  })
  readonly #isInClipTime = computed(() => rangeContainsTime(this.presentationTime, this.root.currentTime))

  declare private _mediaSize: Ref<Size>

  get time(): ClipTime {
    return this._time.value
  }
  get start(): number {
    return this.time.start
  }
  get presentationTime(): ClipTime {
    return this.#presentationTime.value
  }
  get playableTime(): ClipTime {
    return this.#playableTime.value
  }
  get expectedMediaTime(): number {
    return this.#expectedMediaTime.value
  }
  get isInClipTime(): boolean {
    return this.#isInClipTime.value
  }

  get mediaSize(): Size {
    return this._mediaSize.value
  }

  get displayName(): string {
    return this.name || this.sourceAsset.name || ''
  }

  constructor(init: T, root: RootNode) {
    super(init, root)
    this.onDispose(this.#onDispose.bind(this))
  }

  protected _init(init: T): void {
    super._init(init)
    this.clipType = init.clipType

    this.scope = createEffectScope()
    this._time = computed((): ClipTime => {
      const prevTime = this.prev?.time
      const start = prevTime ? prevTime.start + prevTime.duration : 0
      const end = start + this.duration

      const { duration } = this
      const source = this.sourceStart
      return { start, source, duration, end }
    })

    this._mediaSize = computed((): Size => {
      const { video } = this.sourceAsset
      if (!video) return { width: 0, height: 0 }

      const { width, height } = video
      return video.rotation % 180 ? { width: height, height: width } : { width, height }
    })

    this._defineReactive('name', init.name)
    this._defineReactive('sourceStart', init.sourceStart)
    this._defineReactive('transition', init.transition)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isClip(): this is AnyClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  async whenReady(): Promise<void> {
    if (this.isReady) return

    await new Promise<void>((resolve) => {
      this.scope.run(() => {
        const stop = effect(() => {
          if (!this.isReady) return
          stop()
          resolve()
        })
      })
    })
  }

  _ensureDurationIsPlayable(sourceDuration: number): void {
    const clipTime = this.time
    const durationOutsideClip = sourceDuration - (clipTime.source + clipTime.duration)
    this.sourceStart += Math.min(0, durationOutsideClip)
    this.duration = Math.min(clipTime.duration, sourceDuration)
  }

  toObject(): Schema.BaseClip<T['clipType']> {
    const { id, type, clipType, sourceAsset: source, time, transition } = this

    return {
      id,
      type,
      clipType,
      source: { assetId: source.id },
      sourceStart: time.source,
      duration: time.duration,
      transition: transition && { type: transition.type },
    }
  }

  #onDispose() {
    this.container?.destroy()
    this.scope.stop()
  }
}
