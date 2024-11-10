import VideoContext, { type TransitionNode } from 'videocontext'

import { TRANSITION_DURATION_S } from '@/constants'
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
import { useMediaError, useMediaReadyState } from './utils'

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
    transition?: { type: TransitionType }
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
  readyState = useMediaReadyState(this.media)

  #scope = createEffectScope()
  #transitionNode = ref<TransitionNode<{ mix: number }>>()
  #transition = ref<{ type: TransitionType }>()

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
      const startTime = prevTime.start + prevTime.duration - (prev.transition?.duration ?? 0)

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

  get transition(): { duration: number; type: TransitionType } | undefined {
    const value = this.#transition.value

    return (
      value && {
        duration: Math.min(TRANSITION_DURATION_S, this.duration.value, this.next?.duration.value ?? Infinity),
        ...value,
      }
    )
  }
  set transition(transition: Clip.Init['transition'] | undefined) {
    this.#transition.value = transition && { type: transition.type }
  }

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
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

        onCleanup(() => {
          node.destroy()
        })
      })

      effect(() => this.schedule())
      effect(() => (this.node.value.effect = this.filter.value))

      // create out transition
      watch([() => this.#transition.value?.type], ([type], _prev, onCleanup) => {
        if (!type) return (this.#transitionNode.value = undefined)

        const transitionNode = (this.#transitionNode.value = this.track.context.transition<{ mix: number }>(
          VideoContext.DEFINITIONS[type],
        ))

        onCleanup(() => transitionNode.destroy())
      })

      // schedule the out transition
      effect(() => {
        const transitionNode = this.#transitionNode.value
        const { transition, time } = this
        if (!transitionNode || !transition) return

        transitionNode.clearTransitions()
        transitionNode.transitionAt(time.end - transition.duration, time.end, 0, 1, 'mix')
      })
    })

    // Ensure the whole clip duration is playable
    // TODO: always get media duration before setting
    watch([() => this.readyState.value > 0], () => {
      const mediaDuration = this.media.value.duration
      if (!mediaDuration) return

      const clipTime = this.time
      const durationOutsideClip = mediaDuration - (clipTime.source + clipTime.duration)
      this.sourceStart.value += Math.min(0, durationOutsideClip)
      this.duration.value = Math.min(clipTime.duration, mediaDuration)
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

  connect() {
    const node = this.node.value
    const outTransition = this.#transitionNode.value
    const inTransition = this.prev && this.prev.#transitionNode.value

    if (outTransition) {
      outTransition.inputs[0]?.disconnect()
      ;(inTransition ?? node).connect(outTransition, 0)
      outTransition.connect(this.track.node)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition) node.connect(this.track.node)
  }

  disconnect() {
    this.node.value.disconnect()
    const transitionNode = this.#transitionNode.value

    if (transitionNode) {
      transitionNode.disconnect()
      transitionNode.inputs[0]?.disconnect()
      transitionNode.inputs[1]?.disconnect()
    }
  }

  toObject(): Clip.Init {
    const { time } = this

    return {
      sourceStart: time.source,
      duration: time.duration,
      source: this.media.value.src,
      transition: this.transition,
      filter: undefined,
    }
  }

  dispose() {
    this.track = undefined as never
    this.#scope.stop()
  }
}
