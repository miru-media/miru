import { computed, effect, type Ref, ref, watch } from '@/framework/reactivity'
import VideoContext, { type CompositingNode } from 'videocontext'

import { Clip } from './Clip'
import { type Movie } from './Movie'

export namespace Track {
  export interface Init {
    clips: Clip.Init[]
  }
}

export class Track {
  #head = ref<Clip>()
  #tail = ref<Clip>()

  node: Ref<CompositingNode<never>>
  movie: Movie

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
    return (this.#tail.value?.index ?? -1) + 1
  }

  get context() {
    return this.movie.videoContext
  }

  get renderer() {
    return this.movie.renderer
  }

  constructor(init: Track.Init, movie: Movie) {
    this.movie = movie
    this.node = ref(undefined as never)

    // Workaround to recreate processing nodes when the movie resolution changes
    // beacause VideoContext assumes the canvas size is constant
    // TODO
    watch([movie.resolution], (_cur, _prev, onCleanup) => {
      const node = (this.node.value = this.context.compositor(VideoContext.DEFINITIONS.COMBINE))
      onCleanup(() => node.destroy())
    })

    init.clips.forEach((c) => this.pushSingleClip(this.createClip(c)))

    // connect clip nodes and transitions in the correct order
    effect((onCleanup) => {
      const clips = this.toArray()
      clips.forEach((clip) => clip.connect())
      onCleanup(() => clips.forEach((clip) => clip.disconnect()))
    })
  }

  createClip(init: Clip.Init) {
    return new Clip(init, this.context, this, this.renderer)
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
    clip.next = undefined
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

    this.sliceClip(clip)

    clip.next = before

    if (!before) {
      this.pushSingleClip(clip)
      return
    }

    clip.prev = before.prev

    const { head } = this
    const { prev } = before
    if (before === head) this.#head.value = clip
    if (prev) prev.next = clip

    before.prev = clip
  }
}
