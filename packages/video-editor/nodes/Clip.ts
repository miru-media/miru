import { effect, ref, type Ref, toRef, watch } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'

import { createHiddenMediaElement } from 'shared/utils'

import { type ClipSnapshot, type CustomSourceNodeOptions, type TrackMovie } from '../types'
import { useMediaError } from '../utils'
import { AudioElementNode, VideoElementNode } from '../videoContextNodes'

import { type Schema } from '.'

import { type MediaAsset, type VideoEffectAsset } from './Asset'
import { BaseClip } from './BaseClip'
import { type Track } from './Track'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class Clip extends BaseClip {
  filter: Ref<VideoEffectAsset | undefined>
  filterIntensity: Ref<number>

  root: TrackMovie
  parent: Track<Clip>
  media = ref<HTMLVideoElement | HTMLAudioElement>(document.createElement('video'))
  error: Ref<MediaError | undefined>
  node = ref<VideoElementNode | AudioElementNode>(undefined as never)
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

  constructor(init: Schema.Clip, track: Track<Clip>) {
    super(init)

    this.parent = track
    this.root = track.root
    this.filter = ref(init.filter ? this.root.nodes.get<VideoEffectAsset>(init.filter.assetId) : undefined)
    this.filterIntensity = ref(init.filter?.intensity ?? 1)
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

          const transitionNode = (this.#transitionNode.value = this.parent.context.transition<{
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
  }

  connect() {
    const node = this.node.value
    const outTransition = this.#transitionNode.value
    const inTransition = this.prev && this.prev.#transitionNode.value

    if (outTransition) {
      outTransition.inputs[0]?.disconnect()
      ;(inTransition ?? node).connect(outTransition, 0)
      outTransition.connect(this.parent.node.value)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition) node.connect(this.parent.node.value)
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

    this.source = asset
    this.media.value = createHiddenMediaElement(this.parent.trackType, asset.objectUrl)

    const { parent: movie } = this.parent
    const customNodeOptions: CustomSourceNodeOptions = {
      videoEffect: this.filter,
      videoEffectIntensity: this.filterIntensity,
      source: this.source,
      renderer: movie.renderer,
      movieIsPaused: movie.isPaused,
      movieIsStalled: movie.isStalled,
      movieResolution: toRef(() => movie.resolution),
      getClipTime: () => this.time,
      getPresentationTime: () => this.presentationTime,
      getPlayableTime: () => this.playableTime,
    }

    this.node.value = movie.videoContext.customSourceNode(
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

  ensureDurationIsPlayable() {
    const mediaDuration = this.media.value.duration
    if (!mediaDuration) return

    super.ensureDurationIsPlayable(mediaDuration)
  }

  toObject(): Schema.Clip {
    const filterId = this.filter.value?.id

    return {
      ...super.toObject(),
      filter: filterId ? { assetId: filterId, intensity: this.filterIntensity.value } : undefined,
    }
  }

  restoreFromSnapshot({ clip: init, index }: ClipSnapshot) {
    const { nodes } = this.root
    this.setMedia(this.root.nodes.get(init.source.assetId))
    this.sourceStart.value = init.sourceStart
    this.duration.value = init.duration
    this.filter.value = nodes.get<VideoEffectAsset>(init.filter?.assetId ?? '')
    this.filterIntensity.value = init.filter?.intensity ?? 1
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

  dispose() {
    super.dispose()
    this.#unloadCurrentMedia()
    this.root = this.parent = undefined as never
  }
}
