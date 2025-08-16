import { computed, createEffectScope } from 'fine-jsx'

import type { ClipTime } from '../../types/core.ts'
import type { RootNode } from '../../types/internal'
import { TRANSITION_DURATION_S } from '../constants.ts'

import type { MediaAsset } from './assets.ts'
import { BaseNode } from './base-node.ts'
import type { Schema, Track } from './index.ts'

export abstract class BaseClip extends BaseNode<Schema.Clip> implements Schema.Clip {
  id: string
  abstract sourceAsset: MediaAsset
  abstract isReady: boolean
  abstract everHadEnoughData: boolean
  type = 'clip' as const

  declare parent?: Track
  declare root: RootNode
  declare children?: never
  declare name: string

  get start(): number {
    return this.sourceStart
  }

  declare abstract source: Schema.Clip['source']
  declare sourceStart: Schema.Clip['sourceStart']
  declare duration: Schema.Clip['duration']
  declare transition: Schema.Clip['transition']

  scope = createEffectScope()

  readonly #derivedState = computed(
    (): {
      start: number
      end: number
      index: number
    } => {
      const { prev, index } = this
      if (!prev)
        return {
          start: 0,
          end: this.duration,
          index,
        }

      const prevTime = prev.time
      const start = prevTime.start + prevTime.duration

      return { start, end: start + this.duration, index }
    },
  )

  readonly #time = computed((): ClipTime => {
    const { start, end } = this.#derivedState.value
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

    return { start, source, duration, end: time.end }
  })
  readonly #playableTime = computed((): ClipTime => {
    const presentation = this.#presentationTime.value
    if (presentation.source >= 0) return presentation

    const { start, end, source, duration } = presentation
    return { start: start - source, source: 0, duration: duration + source, end }
  })

  get time() {
    return this.#time.value
  }
  get presentationTime() {
    return this.#presentationTime.value
  }
  get _presentationTime() {
    return this.#presentationTime.value
  }
  get playableTime() {
    return this.#playableTime.value
  }

  get displayName() {
    return this.name || this.sourceAsset.name || ''
  }

  abstract filter: Schema.Clip['filter']

  constructor(init: Schema.Clip, root: RootNode) {
    super(init.id, root)
    this.id = init.id

    this._defineReactive('name', init.name)
    this._defineReactive('sourceStart', init.sourceStart)
    this._defineReactive('duration', init.duration)
    this._defineReactive('transition', init.transition)

    this.onDispose(() => {
      this.disconnect()
      this.scope.stop()
    })
  }

  abstract connect(): void
  abstract disconnect(): void

  _ensureDurationIsPlayable(sourceDuration: number) {
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
