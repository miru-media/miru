import { ref, type Ref } from 'fine-jsx'
import VideoContext, { type TransitionNode } from 'videocontext'
import { type Renderer } from 'webgl-effects'

import { EffectInternal } from 'reactive-effects/Effect'

import { BaseClip } from '../BaseClip'
import { type Clip } from '../Clip'
import { Mp4ExtractorNode } from '../custom'
import { type Track } from '../Track'

type TransitionType = keyof typeof VideoContext.DEFINITIONS

export class ExtractorClip extends BaseClip {
  source: string
  filter: Ref<EffectInternal | undefined>

  track: Track<ExtractorClip>
  node: Mp4ExtractorNode
  nodeState = ref<'waiting' | 'sequenced' | 'playing' | 'paused' | 'ended' | 'error'>('waiting')

  #transitionNode = ref<TransitionNode<{ mix: number }>>()
  context: VideoContext

  get outTransitionNode() {
    return this.#transitionNode.value
  }
  get inTransitionNode() {
    return this.prev && this.prev.#transitionNode.value
  }

  get isReady() {
    return this.node.isReady
  }

  constructor(init: Clip.Init, context: VideoContext, track: Track<ExtractorClip>, renderer: Renderer) {
    super(init)
    this.source = init.source
    this.track = track
    this.context = context
    this.filter = ref(init.filter && new EffectInternal(init.filter, renderer))
    this.transition = init.transition

    const { start, end, source: sourceOffset } = this.time
    const { source: url } = init

    this.node = context.customSourceNode(Mp4ExtractorNode, undefined, {
      renderer,
      url,
      sourceOffset,
      start,
      end,
    })

    this.node.effect = this.filter.value
  }

  connect() {
    const { node, time } = this
    node._sourceOffset = time.source
    node.startAt(time.start)
    node.stopAt(time.end)

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
