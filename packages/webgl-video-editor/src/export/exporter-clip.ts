import { ref, toRef } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'

import { TRANSITION_DURATION_S } from '../constants.ts'
import type { MediaAsset, VideoEffectAsset } from '../nodes/assets.ts'
import { BaseClip } from '../nodes/base-clip.ts'
import type { Schema, Track } from '../nodes/index.ts'

import { type ExtractorNodeOptions, MediaExtractorNode } from './media-extractor-node.ts'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class ExtractorClip extends BaseClip {
  readonly #filter = ref<VideoEffectAsset | undefined>()
  readonly #filterIntensity = ref(1)
  track: Track
  node: MediaExtractorNode
  nodeState = ref<'waiting' | 'sequenced' | 'playing' | 'paused' | 'ended' | 'error'>('waiting')
  sourceAsset: MediaAsset
  source: Schema.Clip['source']

  readonly #transitionNode = ref<TransitionNode<{ mix: number }>>()
  context: VideoContext

  get filter(): BaseClip['filter'] {
    const filter = this.#filter.value
    return filter && { assetId: filter.id, intensity: this.#filterIntensity.value }
  }

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  get isReady(): boolean {
    return this.node._isReady()
  }
  get everHadEnoughData(): boolean {
    return this.isReady
  }

  constructor(init: Schema.Clip, track: Track) {
    super(init, track.root)

    const { _renderer: renderer, root } = track

    this.source = init.source
    this.sourceAsset = root.nodes.get(init.source.assetId)
    this.track = track
    this.context = track._context
    this.#filter.value = init.filter && root.nodes.get<VideoEffectAsset>(init.filter.assetId)
    this.#filterIntensity.value = init.filter?.intensity ?? 1
    this.transition = init.transition

    const nodeOptions: ExtractorNodeOptions = {
      videoEffect: this.#filter,
      videoEffectIntensity: this.#filterIntensity,
      source: this.sourceAsset,
      renderer,
      movieIsPaused: ref(false),
      movieIsStalled: ref(false),
      movieResolution: toRef(() => root.resolution),
      getClipTime: () => this.time,
      getPresentationTime: () => this.presentationTime,
      getPlayableTime: () => this.playableTime,
      targetFrameRate: root.frameRate,
    }
    this.node = track._context.customSourceNode(MediaExtractorNode, undefined, nodeOptions)
  }

  connect() {
    const { node } = this

    const transitionType = this.transition?.type
    if (transitionType && transitionType in VideoContext.DEFINITIONS) {
      const transitionNode = (this.#transitionNode.value = this.context.transition<{ mix: number }>(
        VideoContext.DEFINITIONS[transitionType as TransitionType],
      ))

      // schedule the out transition
      const { transition, time } = this
      if (transition) {
        transitionNode.clearTransitions()
        transitionNode.transitionAt(time.end - TRANSITION_DURATION_S, time.end, 0, 1, 'mix')
      }
    }

    const outTransition = this.#transitionNode.value
    const inTransition = this.prev && this.prev.#transitionNode.value

    if (outTransition) {
      outTransition.inputs[0]?.disconnect()
      ;(inTransition ?? node).connect(outTransition, 0)
      outTransition.connect(this.context.destination)
    }
    if (inTransition) {
      inTransition.inputs[1]?.disconnect()
      node.connect(inTransition, 1)
    }

    if (!outTransition && !inTransition) node.connect(this.context.destination)
  }

  disconnect() {
    this.node.disconnect()
    const transitionNode = this.#transitionNode.value

    if (transitionNode) {
      transitionNode.disconnect()
      transitionNode.inputs[0]?.disconnect()
      transitionNode.inputs[1]?.disconnect()
    }
  }

  getSource() {
    return this.sourceAsset
  }

  dispose() {
    super.dispose()
    this.context = undefined as never
    this.#transitionNode.value = undefined
  }
}
