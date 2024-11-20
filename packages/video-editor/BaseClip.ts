import { computed, createEffectScope, onScopeDispose, type Ref, ref } from '@/framework/reactivity'
import { AssetType, type ImageSourceOption } from '@/types'
import { decodeAsyncImageSource, isSyncSource, normalizeSourceOption } from '@/utils'

import { TRANSITION_DURATION_S } from './constants'
import { useMediaError, useMediaReadyState } from './utils'

export namespace BaseClip {
  export interface Init {
    sourceStart: number
    duration: number
    source: ImageSourceOption
    transition?: { type: string }
  }
}

export class BaseClip {
  #prev = ref<typeof this>()
  #next = ref<typeof this>()

  sourceStart: Ref<number>
  duration: Ref<number>
  media = ref<HTMLVideoElement>(undefined as never)
  latestEvent = ref<Event>()
  error: Ref<MediaError | undefined>

  scope = createEffectScope()

  readyState = useMediaReadyState(this.media)

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
      const startTime = prevTime.start + prevTime.duration - (prev.transition?.duration ?? 0)

      return { start: startTime, end: startTime + this.duration.value, index: prev.index + 1 }
    },
  )

  #time = computed(
    (): {
      start: number
      source: number
      duration: number
      end: number
    } => {
      const { start, end } = this.#derivedState.value
      const duration = this.duration.value
      const source = this.sourceStart.value
      return { start, source, duration, end }
    },
  )

  get transition(): { duration: number; type: string } | undefined {
    const value = this.#transition.value

    return (
      value && {
        duration: Math.min(TRANSITION_DURATION_S, this.duration.value, this.next?.duration.value ?? Infinity),
        ...value,
      }
    )
  }
  set transition(transition: BaseClip.Init['transition'] | undefined) {
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

  get index() {
    return this.#derivedState.value.index
  }

  constructor(init: BaseClip.Init) {
    this.sourceStart = ref(init.sourceStart)
    this.duration = ref(init.duration)

    this.setMedia(init.source)
    this.error = useMediaError(this.media)
  }

  setMedia(value: ImageSourceOption) {
    const sourceOption = normalizeSourceOption(value, AssetType.Video)

    if (sourceOption.source instanceof HTMLVideoElement) this.media.value = sourceOption.source
    else {
      if (isSyncSource(sourceOption.source)) {
        throw new Error('[miru] expected video source')
      }

      const { media, close } = decodeAsyncImageSource(sourceOption.source, sourceOption.crossOrigin, true)

      this.scope.run(() => {
        onScopeDispose(close)
      })

      this.media.value = media
    }
  }

  ensureDurationIsPlayable() {
    const mediaDuration = this.media.value.duration
    if (!mediaDuration) return

    const clipTime = this.time
    const durationOutsideClip = mediaDuration - (clipTime.source + clipTime.duration)
    this.sourceStart.value += Math.min(0, durationOutsideClip)
    this.duration.value = Math.min(clipTime.duration, mediaDuration)
  }

  dispose() {
    this.scope.stop()
  }
}
