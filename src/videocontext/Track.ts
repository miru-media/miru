import VideoContext, { CompositingNode } from 'videocontext'

import { computed, ref, watch } from '@/framework/reactivity'

import { Clip } from './Clip'
import { Transition } from './Transition'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Track {
  export interface Init {
    clips: Clip.Init[]
    transitions: Transition.Init[]
  }
}

export class Track {
  clips = ref<Clip[]>([])
  transitions = ref<Transition[]>([])
  node: CompositingNode<never>

  #duration = computed(() => {
    return this.clips.value.reduce((end, clip) => {
      const { start, duration } = clip.time.value
      return Math.max(start + duration, end)
    }, 0)
  })

  get duration() {
    return this.#duration.value
  }
  constructor(init: Track.Init, videoContext: VideoContext) {
    this.node = videoContext.compositor(VideoContext.DEFINITIONS.COMBINE)
    this.clips = ref(init.clips.map((c) => new Clip(c, videoContext)))

    this.transitions.value = init.transitions.map(
      (transitionInit) => new Transition(transitionInit, videoContext),
    )

    watch([this.clips, this.transitions], ([clips, transitions], _prev, onCleanup) => {
      clips.forEach((clip, index) => {
        const clipNode = clip.node.value
        let outTransition, inTransition

        for (const transition of transitions) {
          if (transition.clips.value[0] === index) outTransition = transition
          else if (transition.clips.value[1] === index) inTransition = transition
        }

        if (outTransition) {
          ;(inTransition?.node ?? clipNode).connect(outTransition.node, 0)
          outTransition.node.connect(this.node)
        }
        if (inTransition) clipNode.connect(inTransition.node, 1)

        if (!outTransition && !inTransition) clipNode.connect(this.node)
      })

      onCleanup(() => {
        clips.forEach((clip) => clip.node.value.disconnect(this.node))
        transitions.forEach((t) => t.node.disconnect())
      })
    })
  }
}
