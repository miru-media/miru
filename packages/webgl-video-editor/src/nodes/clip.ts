import { effect, ref, type Ref, toRef, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'

import { createHiddenMediaElement } from 'shared/utils'
import { useMediaError } from 'shared/video/utils'

import type { CustomSourceNodeOptions, RootNode } from '../../types/internal.ts'
import { TRANSITION_DURATION_S } from '../constants.ts'
import { NodeCreateEvent } from '../events.ts'
import { AudioElementNode, VideoElementNode } from '../video-context-nodes/index.ts'

import type { MediaAsset, VideoEffectAsset } from './assets.ts'
import { BaseClip } from './base-clip.ts'
import type { Schema } from './index.ts'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class Clip extends BaseClip {
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  readonly #source = ref<MediaAsset>(undefined as never)
  declare source: Schema.Clip['source']
  error: Ref<MediaError | undefined>
  node = ref<VideoElementNode | AudioElementNode>(undefined as never)
  readonly #transitionNode = ref<TransitionNode<{ mix: number }>>()

  readonly #filter = ref<VideoEffectAsset>()
  readonly #filterIntensity = ref(1)

  get start(): number {
    return this.sourceStart
  }

  get sourceAsset(): MediaAsset {
    return this.#source.value
  }
  set sourceAsset(asset: MediaAsset) {
    this.#setMedia(asset)
  }

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  get isReady(): boolean {
    return this.node.value._isReady()
  }

  get everHadEnoughData(): boolean {
    return this.node.value.mediaState.wasEverPlayable.value
  }

  declare filter: Schema.Clip['filter']

  constructor(init: Schema.Clip, root: RootNode) {
    super(init, root)

    this._defineReactive('source', init.source, {
      onChange: (value) => (this.sourceAsset = this.root.nodes.get(value.assetId)),
      equal: (a, b) => a.assetId === b.assetId,
    })
    this._defineReactive('filter', init.filter, {
      onChange: (value) => {
        this.#filter.value = value && this.root.nodes.get<VideoEffectAsset>(value.assetId)
        this.#filterIntensity.value = value?.intensity ?? 1
      },
      equal: (a, b) => (!a && !b) || (!!a && !!b && a.assetId === b.assetId && a.intensity === b.intensity),
    })

    this.transition = init.transition

    this.error = useMediaError(this.media)
    this.sourceAsset = this.root.nodes.get(init.source.assetId)

    this.scope.run(() => {
      // keep media URL updated
      watch([() => this.sourceAsset.objectUrl], ([url]) => {
        const media = this.media.value
        if (media.src && media.src !== url) media.src = url
      })

      // make sure media type matches parent track type
      watch([() => this.parent], () => this.#setMedia(this.sourceAsset))

      watch(
        [
          () => this.transition?.type,
          // Workaround to recreate processing nodes when the movie resolution changes
          // beacause VideoContext assumes the canvas size is constant
          // TODO
          () => this.root.resolution,
        ],
        ([type], _prev, onCleanup) => {
          if (!type || !(type in VideoContext.DEFINITIONS)) return (this.#transitionNode.value = undefined)

          const transitionNode = (this.#transitionNode.value = this.root.videoContext.transition<{
            mix: number
          }>(VideoContext.DEFINITIONS[type as TransitionType]))

          onCleanup(() => transitionNode.destroy())
        },
      )

      // schedule the out transition
      effect(() => {
        const transitionNode = this.#transitionNode.value
        const { transition, time } = this
        if (!transitionNode || !transition) return

        transitionNode.clearTransitions()
        transitionNode.transitionAt(time.end - TRANSITION_DURATION_S, time.end, 0, 1, 'mix')
      })
    })

    this.onDispose(this.#unloadCurrentMedia.bind(this))
    root._emit(new NodeCreateEvent(this.id))
  }

  connect() {
    const { parent } = this

    const node = this.node.value
    const outTransition = this.#transitionNode.value
    const inTransition = this.prev && this.prev.#transitionNode.value

    if (outTransition) {
      outTransition.inputs[0]?.disconnect()
      ;(inTransition ?? node).connect(outTransition, 0)
      if (parent) outTransition.connect(parent._node.value)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition && parent) node.connect(parent._node.value)
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

  #setMedia(asset: MediaAsset) {
    const { parent, root: movie } = this
    const mediaType = parent?.trackType ?? 'video'

    if (
      typeof this.sourceAsset !== 'undefined' &&
      this.sourceAsset.id === asset.id &&
      this.media.value.nodeName === mediaType
    )
      return

    this.#unloadCurrentMedia()

    this.#source.value = asset

    this.media.value = createHiddenMediaElement(mediaType, asset.objectUrl)

    const customNodeOptions: CustomSourceNodeOptions = {
      videoEffect: this.#filter,
      videoEffectIntensity: this.#filterIntensity,
      source: this.sourceAsset,
      renderer: movie.renderer,
      movieIsPaused: movie.isPaused,
      movieIsStalled: movie.isStalled,
      movieResolution: toRef(() => movie.resolution),
      getClipTime: () => this.time,
      getPresentationTime: () => this.presentationTime,
      getPlayableTime: () => this.playableTime,
    }

    this.node.value = movie.videoContext.customSourceNode<VideoElementNode | AudioElementNode>(
      mediaType === 'video' ? VideoElementNode : AudioElementNode,
      this.media.value,
      customNodeOptions,
    )
  }

  #unloadCurrentMedia() {
    const media = this.media.value
    media.removeAttribute('src')
    media.remove()

    const contextNode = this.node.value
    if (typeof contextNode !== 'undefined') contextNode.destroy()
  }

  _ensureDurationIsPlayable() {
    super._ensureDurationIsPlayable(this.sourceAsset.duration)
  }
}
