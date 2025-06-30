import { type Ref, ref, toRef } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'

import { type Schema, type Track } from '../nodes'
import { type MediaAsset, type VideoEffectAsset } from '../nodes/assets'
import { BaseClip } from '../nodes/base-clip'

import { type ExtractorNodeOptions, MediaExtractorNode } from './media-extractor-node'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class ExtractorClip extends BaseClip {
  filter: Ref<VideoEffectAsset | undefined>

  track: Track<ExtractorClip>
  node: MediaExtractorNode
  nodeState = ref<'waiting' | 'sequenced' | 'playing' | 'paused' | 'ended' | 'error'>('waiting')
  source: MediaAsset

  #transitionNode = ref<TransitionNode<{ mix: number }>>()
  context: VideoContext

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  get isReady() {
    return this.node._isReady()
  }

  constructor(init: Schema.Clip, track: Track<ExtractorClip>) {
    super(init, track)

    const { _renderer: renderer, root } = track

    this.source = root.nodes.get(init.source.assetId)
    this.track = track
    this.context = track._context
    this.filter = ref(init.filter && root.nodes.get<VideoEffectAsset>(init.filter.assetId))
    this.transition = init.transition

    const nodeOptions: ExtractorNodeOptions = {
      videoEffect: this.filter,
      videoEffectIntensity: ref(init.filter?.intensity ?? 1),
      source: this.source,
      renderer,
      movieIsPaused: ref(false),
      movieIsStalled: ref(false),
      movieResolution: toRef(() => track.parent.resolution),
      getClipTime: () => this.time,
      getPresentationTime: () => this.presentationTime,
      getPlayableTime: () => this.playableTime,
      targetFrameRate: track.parent.frameRate.value,
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
        transitionNode.transitionAt(time.end - transition.duration, time.end, 0, 1, 'mix')
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
    return this.source
  }

  dispose() {
    super.dispose()
    this.context = undefined as never
    this.#transitionNode.value = undefined
  }
}
