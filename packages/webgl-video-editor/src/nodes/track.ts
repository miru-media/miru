import { computed, createEffectScope, effect, type Ref, ref, watch } from 'fine-jsx'
import VideoContext, { type CompositingNode } from 'videocontext'

import type { ExportMovie } from '../export/export-movie'

import type { BaseClip, Movie, Schema } from '.'

import { ParentNode } from './parent-node'

type TrackType = 'video' | 'audio'

export class Track<T extends BaseClip> extends ParentNode {
  type = 'track' as const
  readonly #head = ref<T>()
  readonly #tail = ref<T>()

  trackType: TrackType
  _node: Ref<CompositingNode<never>>
  declare parent: Movie | ExportMovie
  declare root: Movie | ExportMovie

  readonly #scope = createEffectScope()

  readonly #duration = computed(() => {
    const lastClip = this.#tail.value
    if (!lastClip) return 0

    const { start, duration } = lastClip.time
    return start + duration
  })
  ClipConstructor: new (init: Schema.Clip, track: Track<T>) => T

  get head() {
    return this.#head.value
  }
  get tail() {
    return this.#tail.value
  }

  get children() {
    return this._mapClips((clip) => clip)
  }

  get duration() {
    return this.#duration.value
  }
  get _count() {
    return (this.#tail.value?.index ?? -1) + 1
  }

  get _context() {
    return this.parent.videoContext
  }

  get _renderer() {
    return this.parent.renderer
  }

  constructor(init: Schema.Track, movie: Movie | ExportMovie, ClipConstructor: Track<T>['ClipConstructor']) {
    super(init.id, movie)
    this.trackType = init.trackType
    this.ClipConstructor = ClipConstructor
    this._node = ref(undefined as never)

    this.#scope.run(() => {
      // Workaround to recreate processing nodes when the movie resolution changes
      // beacause VideoContext assumes the canvas size is constant
      // TODO
      watch([() => movie.resolution], (_cur, _prev, onCleanup) => {
        const node = (this._node.value = this._context.compositor(VideoContext.DEFINITIONS.COMBINE))
        onCleanup(() => !node.destroyed && node.destroy())
      })

      init.children.forEach((c) => this.pushSingleClip(this.createClip(c)))

      // connect clip nodes and transitions in the correct order
      effect((onCleanup) => {
        const clips = this.children
        clips.forEach((clip) => clip.connect())
        onCleanup(() => clips.forEach((clip) => clip.disconnect()))
      })
    })

    this.onDispose(() => {
      this.#head.value = this.#tail.value = undefined
      this._node.value.destroy()
      this.#scope.stop()
    })
  }

  createClip(init: Schema.Clip) {
    return new this.ClipConstructor(init, this)
  }

  positionClipAt(clip: T, index: number) {
    if (clip.index !== index) {
      let other = this.head
      for (; (!!other && other.index < index) || other === clip; other = other.next);

      this.insertClipBefore(clip, other)
    }
  }

  _forEachClip(fn: (clip: T, index: number) => unknown) {
    let index = 0
    for (let current = this.#head.value; current; current = current.next) fn(current, index++)
  }
  _mapClips<U>(fn: (clip: T, index: number) => U) {
    const array: U[] = []
    this._forEachClip((clip, index) => array.push(fn(clip, index)))
    return array
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

  toObject(): Schema.Track {
    return {
      id: this.id,
      type: this.type,
      trackType: this.trackType,
      children: this._mapClips((clip) => clip.toObject()),
    }
  }
}
