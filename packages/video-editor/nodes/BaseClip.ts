import { computed, createEffectScope, type Ref, ref } from 'fine-jsx'

import { TRANSITION_DURATION_S } from '../constants'
import { type ExportMovie } from '../export/ExportMovie'
import { type ClipTime } from '../types'

import { type Movie, type Schema } from '.'

import { type MediaAsset } from './Asset'
import { BaseNode } from './BaseNode'

export class BaseClip extends BaseNode {
  id: string
  source!: MediaAsset
  type = 'clip' as const

  #prev = ref<typeof this>()
  #next = ref<typeof this>()

  declare root: Movie | ExportMovie

  sourceStart: Ref<number>
  duration: Ref<number>

  scope = createEffectScope()

  #transition = ref<{ type: string }>()
  #derivedState = computed(
    (): {
      start: number
      end: number
      index: number
    } => {
      const { prev } = this
      if (!prev)
        return {
          start: 0,
          end: this.duration.value,
          index: 0,
        }

      const prevTime = prev.time
      const start = prevTime.start + prevTime.duration

      return { start, end: start + this.duration.value, index: prev.index + 1 }
    },
  )

  #time = computed((): ClipTime => {
    const { start, end } = this.#derivedState.value
    const duration = this.duration.value
    const source = this.sourceStart.value
    return { start, source, duration, end }
  })
  #presentationTime = computed((): ClipTime => {
    const { time } = this
    const inTransitionDuration = this.prev?.transition?.duration ?? 0

    const start = time.start - inTransitionDuration
    const source = time.source - inTransitionDuration
    const duration = time.duration + inTransitionDuration

    return { start, source, duration, end: time.end }
  })
  #playableTime = computed((): ClipTime => {
    const presentation = this.#presentationTime.value
    if (presentation.source >= 0) return presentation

    const { start, end, source, duration } = presentation
    return { start: start - source, source: 0, duration: duration + source, end }
  })

  get transition(): { duration: number; type: string } | undefined {
    const value = this.#transition.value

    return value && { duration: TRANSITION_DURATION_S, ...value }
  }
  set transition(transition: Schema.Clip['transition'] | undefined) {
    this.#transition.value = transition && { type: transition.type }
  }

  get prev() {
    return this.#prev.value
  }
  set prev(clip: typeof this | undefined) {
    this.#prev.value = clip
  }
  get next() {
    return this.#next.value
  }
  set next(clip: typeof this | undefined) {
    this.#next.value = clip
  }

  get time() {
    return this.#time.value
  }
  get presentationTime() {
    return this.#presentationTime.value
  }
  get playableTime() {
    return this.#playableTime.value
  }

  get index() {
    return this.#derivedState.value.index
  }

  constructor(init: Schema.Clip, parent: BaseClip['parent']) {
    super(init.id, parent)
    this.id = init.id
    this.sourceStart = ref(init.sourceStart)
    this.duration = ref(init.duration)
  }

  connect() {
    // abstract
  }
  disconnect() {
    // abstract
  }

  ensureDurationIsPlayable(sourceDuration: number) {
    const clipTime = this.time
    const durationOutsideClip = sourceDuration - (clipTime.source + clipTime.duration)
    this.sourceStart.value += Math.min(0, durationOutsideClip)
    this.duration.value = Math.min(clipTime.duration, sourceDuration)
  }

  toObject(): Schema.Clip {
    const { id, type, source, time } = this

    return {
      id,
      type,
      source: { assetId: source.id },
      sourceStart: time.source,
      duration: time.duration,
      transition: this.transition,
    }
  }

  _dispose() {
    this.disconnect()
    this.scope.stop()
  }
}
