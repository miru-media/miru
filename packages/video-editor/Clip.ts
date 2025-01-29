import { effect, ref, type Ref, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'
import { type EffectDefinition, type Renderer } from 'webgl-effects'

import { Effect } from 'reactive-effects/Effect'
import { isSyncSource, loadAsyncImageSource, normalizeSourceOption, useEventListener } from 'shared/utils'

import { BaseClip } from './BaseClip'
import { CustomVideoElementNode } from './custom'
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

export namespace Clip {
  export interface Init extends BaseClip.Init {
    filter?: EffectDefinition
  }
}

export class Clip extends BaseClip {
  filter: Ref<Effect | undefined>

  track: Track<Clip>
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  error: Ref<MediaError | undefined>
  readyState = useMediaReadyState(this.media)
  node = ref<CustomVideoElementNode | InstanceType<(typeof VideoContext)['NODES']['AudioNode']>>(
    undefined as never,
  )
  nodeState = ref<'waiting' | 'sequenced' | 'playing' | 'paused' | 'ended' | 'error'>('waiting')
  latestEvent = ref<Event>()
  #isSeeking = ref(false)
  #mediaLoadPromise?: Promise<void>
  #closeMedia?: () => void

  #transitionNode = ref<TransitionNode<{ mix: number }>>()

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  get isReady() {
    return this.filter.value?.isLoading !== true && this.readyState.value >= 2 && !this.#isSeeking.value
  }

  constructor(init: Clip.Init, context: VideoContext, track: Track<Clip>, renderer: Renderer) {
    super(init)

    this.setMedia(init.source)
    this.error = useMediaError(this.media)

    this.track = track
    this.filter = ref(init.filter && new Effect(init.filter, renderer))
    this.transition = init.transition

    const allReadyStateEventTypes = [
      'abort',
      'canplay',
      'canplaythrough',
      'durationchange',
      'emptied',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'waiting',
    ]
    allReadyStateEventTypes.forEach((type) => {
      useEventListener(this.media, type, (event) => {
        this.latestEvent.value = event

        const { readyState } = this.media.value

        switch (type) {
          case 'seeking':
            this.#isSeeking.value = true
            break
          case 'seeked':
            this.#isSeeking.value = readyState < 2
            break
          case 'canplay':
            this.#isSeeking.value = readyState < 2
            break
        }
      })
    })

    useEventListener(this.media, 'loadedmetadata', () => {
      const media = this.media.value
      if (!('mediaSize' in this.node.value) || !('videoWidth' in media)) return

      const { mediaSize } = this.node.value
      mediaSize.width = media.videoWidth
      mediaSize.height = media.videoHeight
    })

    this.scope.run(() => {
      watch([this.media], ([media], _prev, onCleanup) => {
        const node = (this.node.value =
          this.track.type === 'video'
            ? context.customSourceNode(CustomVideoElementNode, media, 1, this.time.source, 1, {
                renderer,
              })
            : this.track.context.audio(media, 1, this.time.source))

        if ('mediaSize' in node && 'videoWidth' in media) {
          if (media.readyState >= 1) {
            const { mediaSize } = node
            mediaSize.width = media.videoWidth
            mediaSize.height = media.videoHeight
          }
        }

        onCleanup(() => node.destroy())
      })

      effect(() => this.schedule())
      effect(() => 'effect' in this.node.value && (this.node.value.effect = this.filter.value))

      watch(
        [
          () => this.transition?.type,
          // Workaround to recreate processing nodes when the movie resolution changes
          // beacause VideoContext assumes the canvas size is constant
          // TODO
          () => track.movie.resolution,
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
    ;(node as { _seek(time: number): void })._seek(this.track.context.currentTime)
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

  setMedia(value: string) {
    const sourceOption = normalizeSourceOption(value, 'video')

    if (isSyncSource(sourceOption.source)) throw new Error('[miru] expected video source')

    const { promise, close } = loadAsyncImageSource(sourceOption.source, sourceOption.crossOrigin, true)

    const mediaLoadPromise = (this.#mediaLoadPromise = promise.then((media) => {
      if (this.#mediaLoadPromise !== mediaLoadPromise) return

      this.#closeMedia?.()
      this.media.value = media
      this.#closeMedia = close
    }))
  }

  ensureDurationIsPlayable() {
    const mediaDuration = this.media.value.duration
    if (!mediaDuration) return

    super.ensureDurationIsPlayable(mediaDuration)
  }

  getSource() {
    return this.media.value.src
  }

  toObject(): Clip.Init {
    return {
      ...super.toObject(),
      filter: this.filter.value?.toObject(),
    }
  }

  dispose() {
    super.dispose()
    this.#closeMedia?.()
    this.track = undefined as never
  }
}
