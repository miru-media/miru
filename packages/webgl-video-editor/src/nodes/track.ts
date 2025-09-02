import { computed, createEffectScope, effect, type Ref, ref, watch } from 'fine-jsx'
import VideoContext, { type CompositingNode } from 'videocontext'
import type { Renderer } from 'webgl-effects'

import type { RootNode } from '../../types/internal'
import { NodeCreateEvent } from '../events.ts'

import type { BaseClip, Collection, Schema } from './index.ts'
import { ParentNode } from './parent-node.ts'

type TrackType = 'video' | 'audio'

export class Track extends ParentNode<Schema.Track, BaseClip> {
  type = 'track' as const

  trackType: TrackType
  _node: Ref<CompositingNode<never>>
  declare parent?: Collection<'timeline'>

  readonly #scope = createEffectScope()

  readonly #duration = computed(() => {
    const lastClip = this.tail
    if (!lastClip) return 0

    const { start, duration } = lastClip.time
    return start + duration
  })

  get duration(): number {
    return this.#duration.value
  }

  get _context(): VideoContext {
    return this.root.videoContext
  }

  get _renderer(): Renderer {
    return this.root.renderer
  }

  constructor(init: Schema.Track, root: RootNode) {
    super(init.id, root)

    this.trackType = init.trackType
    this._node = ref(undefined as never)

    this.#scope.run(() => {
      // Workaround to recreate processing nodes when the movie resolution changes
      // beacause VideoContext assumes the canvas size is constant
      // TODO
      watch([() => this.root.resolution], (_cur, _prev, onCleanup) => {
        const node = (this._node.value = this._context.compositor(VideoContext.DEFINITIONS.COMBINE))
        onCleanup(() => !node.destroyed && node.destroy())
      })

      // connect clip nodes and transitions in the correct order
      effect((onCleanup) => {
        const clips = this.children
        clips.forEach((clip) => clip.connect())
        onCleanup(() => clips.forEach((clip) => clip.disconnect()))
      })
    })

    this.onDispose(() => {
      this._node.value.destroy()
      this.#scope.stop()
    })

    root._emit(new NodeCreateEvent(this.id))
  }

  toObject(): Schema.Track {
    return {
      id: this.id,
      type: this.type,
      trackType: this.trackType,
    }
  }
}
