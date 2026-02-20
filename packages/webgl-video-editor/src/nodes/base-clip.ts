import { computed, createEffectScope, effect } from 'fine-jsx'
import type * as Pixi from 'pixi.js'

import type { Size } from 'shared/types.ts'
import { IS_FIREFOX } from 'shared/userAgent.ts'
import { fit } from 'shared/utils/images.ts'
import { clamp } from 'shared/utils/math.ts'
import { rangeContainsTime } from 'shared/video/utils.ts'

import type { ClipTime } from '../../types/core.ts'
import type { RootNode } from '../../types/internal'
import type { MediaAsset } from '../assets.ts'
import { TRANSITION_DURATION_S, VIDEO_PREPLAY_TIME_S } from '../constants.ts'

import type { Schema } from './index.ts'
import { TrackChild } from './track-child.ts'

export abstract class BaseClip extends TrackChild<Schema.Clip> {
  abstract sourceAsset: MediaAsset
  abstract isReady: boolean
  abstract everHadEnoughData: boolean
  type = 'clip' as const

  declare root: RootNode
  declare children: undefined
  declare name: string

  abstract container?: Pixi.Sprite
  get sprite(): Pixi.Sprite | undefined {
    return this.container
  }

  declare abstract source: Schema.Clip['source']
  declare sourceStart: Schema.Clip['sourceStart']
  declare duration: Schema.Clip['duration']
  declare transition: Schema.Clip['transition']

  scope = createEffectScope()

  readonly #time = computed((): ClipTime => {
    const prevTime = this.prev?.time
    const start = prevTime ? prevTime.start + prevTime.duration : 0
    const end = start + this.duration

    const { duration } = this
    const source = this.sourceStart
    return { start, source, duration, end }
  })
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

  readonly #mediaSize = computed((): Size => {
    const { video } = this.sourceAsset
    if (!video) return { width: 0, height: 0 }

    const { width, height } = video
    return video.rotation % 180 ? { width: height, height: width } : { width, height }
  })

  get time(): ClipTime {
    return this.#time.value
  }
  get start(): number {
    return this.time.start
  }
  get presentationTime(): ClipTime {
    return this.#presentationTime.value
  }
  get _presentationTime(): ClipTime {
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
    return this.#mediaSize.value
  }

  get displayName(): string {
    return this.name || this.sourceAsset.name || ''
  }

  abstract filter: Schema.Clip['filter']

  constructor(init: Schema.Clip, root: RootNode) {
    super(init, root)

    this._defineReactive('name', init.name)
    this._defineReactive('sourceStart', init.sourceStart)
    this._defineReactive('transition', init.transition)

    this.onDispose(() => {
      this.sprite?.destroy()
      this.scope.stop()
    })
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isClip(): this is BaseClip {
    return true
  }

  resizeSprite(isExtracting = false): void {
    const { video } = this.sourceAsset
    const { sprite } = this
    if (!video || !sprite) return

    const fitProps = fit(this.mediaSize, this.root.resolution, 'cover')
    sprite.scale.set(fitProps.scaleX, fitProps.scaleY)
    sprite.position.set(fitProps.x, fitProps.y)

    let rotation = this.sourceAsset.video?.rotation ?? 0

    if (rotation % 180 && (IS_FIREFOX || (isExtracting && rotation !== 90))) {
      if (IS_FIREFOX) rotation = -rotation

      sprite.angle = rotation
      if (rotation === 90) sprite.position.x += fitProps.width
      else sprite.position.y += fitProps.height
    }
  }

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

  toObject(): Schema.Clip {
    const { id, type, sourceAsset: source, time, transition, filter } = this

    return {
      id,
      type,
      source: { assetId: source.id },
      sourceStart: time.source,
      duration: time.duration,
      transition: transition && { type: transition.type },
      filter: filter && { assetId: filter.assetId, intensity: filter.intensity },
    }
  }
}
