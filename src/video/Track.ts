import VideoContext, { type CompositingNode } from 'videocontext'

import { computed, effect, ref } from '@/framework/reactivity'
import { type Renderer } from '@/renderer/Renderer'

import { Clip } from './Clip'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Track {
  export interface Init {
    clips: Clip.Init[]
  }
}

export class Track {
  #head = ref<Clip>()
  #tail = ref<Clip>()

  node: CompositingNode<never>
  context: VideoContext

  #duration = computed(() => {
    const lastClip = this.#tail.value
    if (!lastClip) return 0

    const { start, duration } = lastClip.time
    return start + duration
  })

  get head() {
    return this.#head.value
  }
  get tail() {
    return this.#tail.value
  }

  get duration() {
    return this.#duration.value
  }
  get count() {
    return this.#tail.value?.index ?? 0
  }

  constructor(init: Track.Init, videoContext: VideoContext, renderer: Renderer) {
    this.context = videoContext
    this.node = videoContext.compositor(VideoContext.DEFINITIONS.COMBINE)
    init.clips.forEach((c) => this.pushSingleClip(new Clip(c, videoContext, this, renderer)))

    // connect clip nodes and transitions in the correct order
    effect((onCleanup) => {
      const clips = this.toArray()
      clips.forEach((clip) => clip.connect())
      onCleanup(() => clips.forEach((clip) => clip.disconnect()))
    })
  }

  forEachClip(fn: (clip: Clip, index: number) => unknown) {
    let index = 0
    for (let current = this.#head.value; current; current = current.next) fn(current, index++)
  }
  mapClips<T>(fn: (clip: Clip, index: number) => T) {
    const array: T[] = []
    this.forEachClip((clip, index) => array.push(fn(clip, index)))
    return array
  }
  toArray() {
    return this.mapClips((clip) => clip)
  }

  pushSingleClip(clip: Clip) {
    const tail = this.#tail.value
    if (tail === clip) return

    if (!tail) this.#head.value = clip
    else {
      tail.next = clip
      clip.prev = tail
    }

    this.#tail.value = clip
  }

  sliceClip(clip: Clip) {
    const { head, tail } = this
    const { prev, next } = clip

    if (clip === head) this.#head.value = next
    if (clip === tail) this.#tail.value = prev
    if (prev) prev.next = next
    if (next) next.prev = prev

    clip.prev = clip.next = undefined
  }

  insertClipBefore(clip: Clip, before: Clip | undefined) {
    if (clip === before) return

    clip.next = before
    clip.prev = before?.prev

    if (!before) {
      this.pushSingleClip(clip)
      return
    }

    const { head } = this
    const { prev } = before
    if (before === head) this.#head.value = clip
    if (prev) prev.next = clip

    before.prev = clip
  }
}
