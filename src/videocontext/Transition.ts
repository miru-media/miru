import VideoContext, { TransitionNode } from 'videocontext'

import { effect, ref, Ref } from '@/framework/reactivity'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Transition {
  export type Type = keyof typeof VideoContext.DEFINITIONS
  export interface Init {
    clips: [outIndex: number, inIndex: number]
    start: number
    duration: number
    type: Type
  }
}

export class Transition {
  clips: Ref<[outIndex: number, inIndex: number]>
  start: Ref<number>
  duration: Ref<number>
  node!: TransitionNode<{ mix: number }>

  constructor(init: Transition.Init, videoContext: VideoContext) {
    this.clips = ref(init.clips)
    this.start = ref(init.start)
    this.duration = ref(init.duration)

    this.node = videoContext.transition(VideoContext.DEFINITIONS[init.type])

    effect((onCleanup) => {
      const { node } = this

      const start = this.start.value
      node.transitionAt(start, start + this.duration.value, 0, 1, 'mix')
      onCleanup(() => node.clearTransitions())
    })
  }
}
