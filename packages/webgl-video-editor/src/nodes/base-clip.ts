import { computed, createEffectScope, type Ref, ref } from 'fine-jsx'

import type { ClipTime } from '../../types/core.ts'
import { TRANSITION_DURATION_S } from '../constants.ts'
import type { ExportMovie } from '../export/export-movie.ts'

import type { MediaAsset } from './assets.ts'
import { BaseNode } from './base-node.ts'
import type { Movie, Schema, Track } from './index.ts'

export abstract class BaseClip extends BaseNode {
  id: string
  abstract source: MediaAsset
  type = 'clip' as const

  readonly #prev = ref<typeof this>()
  readonly #next = ref<typeof this>()

  declare root: Movie | ExportMovie
  declare parent: Track<any>
  declare name?: string

  readonly #sourceStart: Ref<number>
  readonly #duration: Ref<number>

  scope = createEffectScope()

  readonly #transition = ref<{ type: string }>()
  readonly #derivedState = computed(
    (): {
      start: number
      end: number
      index: number
    } => {
      const { prev } = this
      if (!prev)
        return {
          start: 0,
          end: this.duration,
          index: 0,
        }

      const prevTime = prev.time
      const start = prevTime.start + prevTime.duration

      return { start, end: start + this.duration, index: prev.index + 1 }
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
    const inTransitionDuration = this.prev?.transition?.duration ?? 0

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

  get transition(): { duration: number; type: string } | undefined {
    const { value } = this.#transition

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

  get duration() {
    return this.#duration.value
  }
  set duration(durationS) {
    this.#duration.value = durationS
  }
  get sourceStart() {
    return this.#sourceStart.value
  }
  set sourceStart(sourceStartS) {
    this.#sourceStart.value = sourceStartS
  }
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

  get index() {
    return this.#derivedState.value.index
  }

  get displayName() {
    return (this.name ?? '') || this.source.name
  }

  constructor(init: Schema.Clip, parent: BaseClip['parent']) {
    super(init.id, parent)
    this.id = init.id
    this.#sourceStart = ref(init.sourceStart)
    this.#duration = ref(init.duration)
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
    this.#duration.value = Math.min(clipTime.duration, sourceDuration)
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
}
