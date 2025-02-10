import { computed, effect, type Ref, ref, watch } from 'fine-jsx'
import { uid } from 'uid'
import VideoContext, { type CompositingNode } from 'videocontext'
import { type Renderer } from 'webgl-effects'

import { type BaseClip } from './BaseClip'
import { type Clip } from './Clip'
import { type TrackMovie } from './types'

type TrackType = 'video' | 'audio'

export namespace Track {
  export type Type = TrackType
  export interface Init {
    id?: string
    type: TrackType
    clips: Clip.Init[]
  }
}

export class Track<T extends BaseClip> {
  id: string
  #head = ref<T>()
  #tail = ref<T>()

  type: TrackType
  node: Ref<CompositingNode<never>>
  movie: TrackMovie

  #duration = computed(() => {
    const lastClip = this.#tail.value
    if (!lastClip) return 0

    const { start, duration } = lastClip.time
    return start + duration
  })
  ClipConstructor: new (init: Clip.Init, context: VideoContext, track: Track<T>, renderer: Renderer) => T

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

  constructor(init: Track.Init, movie: TrackMovie, ClipConstructor: Track<T>['ClipConstructor']) {
    this.id = init.id ?? uid()
    this.type = init.type
    this.movie = movie
    this.ClipConstructor = ClipConstructor
    this.node = ref(undefined as never)

    // Workaround to recreate processing nodes when the movie resolution changes
    // beacause VideoContext assumes the canvas size is constant
    // TODO
    watch([() => movie.resolution], (_cur, _prev, onCleanup) => {
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
    return new this.ClipConstructor(init, this.context, this, this.renderer)
  }

  positionClipAt(clip: T, index: number) {
    if (clip.index !== index) {
      let other = this.head
      for (; (other && other.index < index) || other === clip; other = other.next);

      this.insertClipBefore(clip, other)
    }
  }

  forEachClip(fn: (clip: T, index: number) => unknown) {
    let index = 0
    for (let current = this.#head.value; current; current = current.next) fn(current, index++)
  }
  mapClips<U>(fn: (clip: T, index: number) => U) {
    const array: U[] = []
    this.forEachClip((clip, index) => array.push(fn(clip, index)))
    return array
  }
  toArray() {
    return this.mapClips((clip) => clip)
  }

  pushSingleClip(clip: T) {
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

  deleteClip(clip: T) {
    const { head, tail } = this
    const { prev, next } = clip

    if (clip === head) this.#head.value = next
    if (clip === tail) this.#tail.value = prev
    if (prev) prev.next = next
    if (next) next.prev = prev

    clip.prev = clip.next = undefined
  }

  insertClipBefore(clip: T, before: T | undefined) {
    if (clip === before) return

    this.deleteClip(clip)

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

  toObject(): Track.Init {
    return {
      type: this.type,
      clips: this.mapClips((clip) => clip.toObject()),
    }
  }

  dispose() {
    this.toArray().forEach((clip) => clip.dispose())
    this.#head.value = this.#tail.value = undefined
    this.node.value.destroy()
  }
}
