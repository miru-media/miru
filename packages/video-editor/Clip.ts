import { effect, ref, type Ref, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'
import { type EffectDefinition, type Renderer } from 'webgl-effects'

import { Effect } from 'reactive-effects/Effect'
import { isSyncSource, loadAsyncImageSource, normalizeSourceOption } from 'shared/utils'

import { BaseClip } from './BaseClip'
import { type Track } from './Track'
import { type CustomSourceNodeOptions } from './types'
import { useMediaError, useMediaReadyState } from './utils'
import { AudioElementNode, VideoElementNode } from './videoContextNodes'

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
  node = ref<VideoElementNode | AudioElementNode>(undefined as never)
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
    return this.node.value._isReady()
  }

  get everHadEnoughData() {
    return this.node.value.mediaState.wasEverPlayable.value
  }

  constructor(init: Clip.Init, context: VideoContext, track: Track<Clip>, renderer: Renderer) {
    super(init)

    this.track = track
    this.setMedia(init.source)
    this.error = useMediaError(this.media)

    this.filter = ref(init.filter && new Effect(init.filter, renderer))
    this.transition = init.transition

    this.scope.run(() => {
      watch([this.media], ([media], _prev, onCleanup) => {
        const customNodeOptions: CustomSourceNodeOptions = {
          renderer,
          movieIsPaused: track.movie.isPaused,
          movieIsStalled: track.movie.isStalled,
          getClipTime: () => this.time,
          getPresentationTime: () => this.presentationTime,
          getPlayableTime: () => this.playableTime,
        }
        const node = (this.node.value = context.customSourceNode(
          this.track.type === 'video' ? VideoElementNode : AudioElementNode,
          media,
          customNodeOptions,
        ))
        onCleanup(() => node.destroy())
      })

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

    if (this.track.type === 'audio') {
      const audio = document.createElement('audio')
      audio.preload = 'auto'
      audio.src = value
      audio.load()
      document.body.appendChild(audio)

      this.media.value = audio
      this.#closeMedia = () => {
        audio.removeAttribute('src')
        audio.remove()
      }
      this.#mediaLoadPromise = Promise.resolve()
      return
    }

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
