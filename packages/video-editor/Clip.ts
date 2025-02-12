import { effect, ref, type Ref, toRef, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'
import { type EffectDefinition, type Renderer } from 'webgl-effects'

import { Effect } from 'reactive-effects/Effect'
import { loadAsyncImageSource } from 'shared/utils'

import { BaseClip } from './BaseClip'
import { type Track } from './Track'
import { type ClipMediaMetadata, type ClipSnapshot, type CustomSourceNodeOptions } from './types'
import { useMediaError, useMediaReadyState } from './utils'
import { AudioElementNode, VideoElementNode } from './videoContextNodes'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export namespace Clip {
  export interface Init extends BaseClip.Init {
    sourceMetadata?: ClipMediaMetadata
    filter?: EffectDefinition
    filterIntensity?: number
  }
}

export class Clip extends BaseClip {
  filter: Ref<Effect | undefined>
  filterIntensity: Ref<number>

  track: Track<Clip>
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  error: Ref<MediaError | undefined>
  readyState = useMediaReadyState(this.media)
  node = ref<VideoElementNode | AudioElementNode>(undefined as never)
  #mediaLoadPromise?: Promise<void>
  url = ''
  mediaMetadata: ClipMediaMetadata = { rotation: 0 }
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
    this.setMedia(init.source, init.sourceMetadata)
    this.error = useMediaError(this.media)

    this.filter = ref(init.filter && new Effect(init.filter, renderer))
    this.filterIntensity = ref(init.filterIntensity ?? 1)
    this.transition = init.transition

    this.scope.run(() => {
      watch([this.media], ([media], _prev, onCleanup) => {
        const { movie } = track
        const customNodeOptions: CustomSourceNodeOptions = {
          videoEffect: this.filter,
          videoEffectIntensity: this.filterIntensity,
          mediaMetadata: this.mediaMetadata,
          renderer,
          movieIsPaused: movie.isPaused,
          movieIsStalled: movie.isStalled,
          movieResolution: toRef(() => movie.resolution),
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

  setMedia(url: string, options?: { rotation: number }) {
    if (this.url && url === this.url) return

    this.url = url
    this.mediaMetadata.rotation = options?.rotation ?? 0

    if (this.track.type === 'audio') {
      const audio = document.createElement('audio')
      audio.preload = 'auto'
      audio.src = url
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

    const { promise, close } = loadAsyncImageSource(url, undefined, true)

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
    return this.url
  }

  toObject(): Clip.Init {
    return {
      ...super.toObject(),
      id: this.id,
      filter: this.filter.value?.toObject(),
      filterIntensity: this.filterIntensity.value,
      sourceMetadata: this.mediaMetadata,
    }
  }

  restoreFromSnapshot({ clip: init, index }: ClipSnapshot, effects: Map<string, Effect>) {
    this.setMedia(init.source, init.sourceMetadata)
    this.sourceStart.value = init.sourceStart
    this.duration.value = init.duration
    this.filter.value = effects.get(init.filter?.id ?? '')
    this.filterIntensity.value = init.filterIntensity ?? 1
    this.track.positionClipAt(this, index)
  }

  getSnapshot(): ClipSnapshot {
    return {
      clip: this.toObject(),
      id: this.id,
      trackId: this.track.id,
      index: this.index,
    }
  }

  dispose() {
    super.dispose()
    this.#closeMedia?.()
    this.track = undefined as never
  }
}
