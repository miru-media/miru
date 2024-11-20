import { effect, ref, type Ref, watch } from '@/framework/reactivity'
import { type Effect } from '@/types'
import { useEventListener } from '@/utils'
import { EffectInternal } from 'reactive-effects/Effect'
import { type Renderer } from 'renderer/Renderer'
import VideoContext, { type TransitionNode } from 'videocontext'

import { BaseClip } from './BaseClip'
import { MiruVideoNode } from './custom'
import { type Track } from './Track'

export enum SourceNodeState {
  waiting = 0,
  sequenced = 1,
  playing = 2,
  paused = 3,
  ended = 4,
  error = 5,
}

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export namespace Clip {
  export interface Init extends BaseClip.Init {
    filter?: Effect
  }
}

export class Clip extends BaseClip {
  filter: Ref<EffectInternal | undefined>

  track: Track
  node = ref<MiruVideoNode>(undefined as never)
  nodeState = ref<'waiting' | 'sequenced' | 'playing' | 'paused' | 'ended' | 'error'>('waiting')

  #transitionNode = ref<TransitionNode<{ mix: number }>>()

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  constructor(init: Clip.Init, context: VideoContext, track: Track, renderer: Renderer) {
    super(init)
    this.track = track
    this.filter = ref(init.filter && new EffectInternal(init.filter, renderer))
    this.transition = init.transition

    const allReadyStateEventTypes = [
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
    allReadyStateEventTypes.forEach((type) =>
      useEventListener(this.media, type, (event) => (this.latestEvent.value = event)),
    )

    this.scope.run(() => {
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

      watch(
        [
          () => this.transition?.type,
          // Workaround to recreate processing nodes when the movie resolution changes
          // beacause VideoContext assumes the canvas size is constant
          // TODO
          track.movie.resolution,
        ],
        ([type], _prev, onCleanup) => {
          if (!type || !(type in VideoContext.DEFINITIONS)) return (this.#transitionNode.value = undefined)

          const transitionNode = (this.#transitionNode.value = this.track.context.transition<{ mix: number }>(
            VideoContext.DEFINITIONS[type as TransitionType],
          ))

          onCleanup(() => transitionNode.destroy())
        },
      )

      // schedule the out transition
      effect(() => {
        const transitionNode = this.#transitionNode.value
        const { transition, time } = this
        if (!transitionNode || !transition) return

        transitionNode.clearTransitions()
        transitionNode.transitionAt(time.end - transition.duration, time.end, 0, 1, 'mix')
      })
    })
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
      outTransition.connect(this.track.node.value)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition) node.connect(this.track.node.value)
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
    super.dispose()
    this.track = undefined as never
  }
}
