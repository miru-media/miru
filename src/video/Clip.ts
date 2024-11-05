import VideoContext, { type TransitionNode } from 'videocontext'

import { EffectInternal } from '@/Effect'
import {
  computed,
  createEffectScope,
  effect,
  onScopeDispose,
  ref,
  type Ref,
  watch,
} from '@/framework/reactivity'
import { type Renderer } from '@/renderer/Renderer'
import { AssetType, type Effect, type ImageSourceOption } from '@/types'
import { decodeAsyncImageSource, isSyncSource, normalizeSourceOption, useEventListener } from '@/utils'

import { MiruVideoNode } from './custom'
import { type Track } from './Track'
import { useMediaError } from './utils'

export enum SourceNodeState {
  waiting = 0,
  sequenced = 1,
  playing = 2,
  paused = 3,
  ended = 4,
  error = 5,
}

type TransitionType = keyof typeof VideoContext.DEFINITIONS
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Clip {
  export interface Init {
    sourceStart: number
    duration: number
    source: ImageSourceOption
    filter?: Effect
    transition?: { duration: number; type: TransitionType }
  }
}

export class Clip {
  #prev = ref<Clip>()
  #next = ref<Clip>()

  sourceStart: Ref<number>
  duration: Ref<number>
  media = ref<HTMLVideoElement>(undefined as never)
  filter: Ref<EffectInternal | undefined>

  track: Track
  node = ref<MiruVideoNode>(undefined as never)
  latestEvent = ref<Event>()
  error: Ref<MediaError | undefined>

  #scope = createEffectScope()
  #transition = ref<{ duration: number; type: TransitionType; node: TransitionNode<{ mix: number }> }>()

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
      const startTime = prevTime.start + prevTime.duration - (prev.#transition.value?.duration ?? 0)

      return { start: startTime, end: startTime + this.duration.value, index: prev.index + 1 }
    },
  )

  get time() {
    return this.#time.value
  }

  get prev() {
    return this.#prev.value
  }
  set prev(clip: Clip | undefined) {
    this.#prev.value = clip
  }
  get next() {
    return this.#next.value
  }
  set next(clip: Clip | undefined) {
    this.#next.value = clip
  }

  get index() {
    return this.#derivedState.value.index
  }

  set transition(transition: Clip.Init['transition'] | undefined) {
    this.#transition.value?.node.destroy()

    if (!transition) {
      this.#transition.value = undefined
      return
    }

    const { type, duration } = transition
    const { end } = this.time
    const node = this.track.context.transition<{ mix: number }>(VideoContext.DEFINITIONS[type])

    node.transitionAt(end - transition.duration, end, 0, 1, 'mix')
    this.#transition.value = { type, duration, node }
  }
  get transition() {
    const transition = this.#transition.value
    if (!transition) return undefined

    return { type: transition.type, duration: transition.duration }
  }

  constructor(init: Clip.Init, context: VideoContext, track: Track, renderer: Renderer) {
    this.track = track
    this.sourceStart = ref(init.sourceStart)
    this.duration = ref(init.duration)
    this.filter = ref(init.filter && new EffectInternal(init.filter, renderer))

    this.setMedia(init.source)
    this.transition = init.transition

    this.error = useMediaError(this.media)
    const allEventTypes = [
      'abort',
      'canplay',
      'canplaythrough',
      'durationchange',
      'emptied',
      'encrypted',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'progress',
      'ratechange',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'volumechange',
      'waiting',
    ]
    allEventTypes.forEach((type) =>
      useEventListener(this.media, type, (event) => (this.latestEvent.value = event)),
    )

    this.#scope.run(() => {
      watch([this.media], ([media], _prev, onCleanup) => {
        const node = (this.node.value = context.customSourceNode(
          MiruVideoNode,
          media,
          this.time.source,
          undefined,
          { renderer },
        ))

        onCleanup(() => node.destroy())
      })

      effect(() => this.schedule())
      effect(() => (this.node.value.effect = this.filter.value))

      // schedule the clip's out transition
      effect((onCleanup) => {
        const transition = this.#transition.value
        if (!transition) return

        const { end } = this.time
        transition.node.transitionAt(end - transition.duration, end, 0, 1, 'mix')

        onCleanup(() => transition.node.clearTransitions())
      })

      // connect this clip node to the parent track and/or in and out transitions
      effect((onCleanup) => {
        const node = this.node.value
        const outTransition = this.#transition.value?.node
        const inTransition = this.prev && this.prev.#transition.value?.node

        if (outTransition) {
          ;(inTransition ?? node).connect(outTransition, 0)
          outTransition.connect(this.track.node)
        }
        if (inTransition) node.connect(inTransition, 1)

        if (!outTransition && !inTransition) node.connect(this.track.node)

        onCleanup(() => {
          this.#transition.value?.node.disconnect()
          this.node.value.disconnect()
        })
      })
    })
  }

  setMedia(value: ImageSourceOption) {
    const sourceOption = normalizeSourceOption(value, AssetType.Video)

    if (sourceOption.source instanceof HTMLVideoElement) this.media.value = sourceOption.source
    else {
      if (isSyncSource(sourceOption.source)) {
        throw new Error('[miru] expected video source')
      }

      const { media, close } = decodeAsyncImageSource(sourceOption.source, sourceOption.crossOrigin, true)

      this.#scope.run(() => {
        onScopeDispose(close)
      })

      this.media.value = media
    }
  }

  schedule() {
    const node = this.node.value
    const { time } = this

    node._sourceOffset = time.source
    node.clearTimelineState()
    node.startAt(time.start)
    node.stopAt(time.end)
    node._seek(this.track.context.currentTime)
  }

  toObject(): Clip.Init {
    const { time } = this

    return {
      sourceStart: time.source,
      duration: time.duration,
      source: this.media.value.src,
      filter: undefined,
    }
  }

  dispose() {
    this.track = undefined as never
    this.#scope.stop()
  }
}
