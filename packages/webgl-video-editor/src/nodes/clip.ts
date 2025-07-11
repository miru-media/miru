import { effect, ref, type Ref, toRef, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'

import { createHiddenMediaElement } from 'shared/utils'
import { useMediaError } from 'shared/video/utils'

import type { ClipSnapshot, CustomSourceNodeOptions } from '../../types/internal'
import { AudioElementNode, VideoElementNode } from '../video-context-nodes'

import type { Schema } from '.'

import type { MediaAsset, VideoEffectAsset } from './assets'
import { BaseClip } from './base-clip'
import type { Track } from './track'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class Clip extends BaseClip {
  declare parent: Track<Clip>
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  readonly #source = ref<MediaAsset>(undefined as never)
  error: Ref<MediaError | undefined>
  node = ref<VideoElementNode | AudioElementNode>(undefined as never)
  readonly #transitionNode = ref<TransitionNode<{ mix: number }>>()

  readonly #filter: Ref<VideoEffectAsset | undefined>
  readonly #filterIntensity: Ref<number>

  get start() {
    return this.sourceStart
  }

  get source() {
    return this.#source.value
  }

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

  get filter() {
    const { value } = this.#filter
    return value && { id: value.id, name: value.name, intensity: this.#filterIntensity.value }
  }

  constructor(init: Schema.Clip, track: Track<Clip>) {
    super(init, track)

    this.#filter = ref(init.filter ? this.root.nodes.get<VideoEffectAsset>(init.filter.assetId) : undefined)
    this.#filterIntensity = ref(init.filter?.intensity ?? 1)
    this.transition = init.transition

    this.error = useMediaError(this.media)

    this.setMedia(this.root.nodes.get(init.source.assetId))

    this.scope.run(() => {
      // keep media URL updated
      watch([() => this.source.objectUrl], ([url]) => {
        const media = this.media.value
        if (media.src && media.src !== url) media.src = url
      })

      watch(
        [
          () => this.transition?.type,
          // Workaround to recreate processing nodes when the movie resolution changes
          // beacause VideoContext assumes the canvas size is constant
          // TODO
          () => track.parent.resolution,
        ],
        ([type], _prev, onCleanup) => {
          if (!type || !(type in VideoContext.DEFINITIONS)) return (this.#transitionNode.value = undefined)

          const transitionNode = (this.#transitionNode.value = this.parent._context.transition<{
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
        transitionNode.transitionAt(time.end - transition.duration, time.end, 0, 1, 'mix')
      })
    })

    this.onDispose(this.#unloadCurrentMedia.bind(this))
  }

  connect() {
    const node = this.node.value
    const outTransition = this.#transitionNode.value
    const inTransition = this.prev && this.prev.#transitionNode.value

    if (outTransition) {
      outTransition.inputs[0]?.disconnect()
      ;(inTransition ?? node).connect(outTransition, 0)
      outTransition.connect(this.parent._node.value)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition) node.connect(this.parent._node.value)
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

  setMedia(asset: MediaAsset) {
    if (typeof this.source !== 'undefined' && this.source.id === asset.id) return

    this.#unloadCurrentMedia()

    this.#source.value = asset
    this.media.value = createHiddenMediaElement(this.parent.trackType, asset.objectUrl)

    const { parent: movie } = this.parent
    const customNodeOptions: CustomSourceNodeOptions = {
      videoEffect: this.#filter,
      videoEffectIntensity: this.#filterIntensity,
      source: this.source,
      renderer: movie.renderer,
      movieIsPaused: movie.isPaused,
      movieIsStalled: movie.isStalled,
      movieResolution: toRef(() => movie.resolution),
      getClipTime: () => this.time,
      getPresentationTime: () => this.presentationTime,
      getPlayableTime: () => this.playableTime,
    }

    this.node.value = movie.videoContext.customSourceNode<VideoElementNode | AudioElementNode>(
      this.parent.trackType === 'video' ? VideoElementNode : AudioElementNode,
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
    const mediaDuration = this.media.value.duration
    if (!mediaDuration) return

    super._ensureDurationIsPlayable(mediaDuration)
  }

  _setFiler(filter: VideoEffectAsset | undefined, intensity: number) {
    this.#filter.value = filter
    this.#filterIntensity.value = intensity
  }

  toObject(): Schema.Clip {
    const { filter } = this

    return {
      ...super.toObject(),
      filter: filter && { assetId: filter.id, intensity: filter.intensity },
    }
  }

  restoreFromSnapshot({ clip: init, index }: ClipSnapshot) {
    const { nodes } = this.root
    this.setMedia(this.root.nodes.get(init.source.assetId))
    this.sourceStart = init.sourceStart
    this.duration = init.duration
    this.#filter.value = nodes.get<VideoEffectAsset>(init.filter?.assetId ?? '')
    this.#filterIntensity.value = init.filter?.intensity ?? 1
    this.parent.positionClipAt(this, index)
  }

  getSnapshot(): ClipSnapshot {
    return {
      clip: this.toObject(),
      id: this.id,
      trackId: this.parent.id,
      index: this.index,
    }
  }
}
