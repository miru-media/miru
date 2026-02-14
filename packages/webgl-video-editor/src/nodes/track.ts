import { computed, createEffectScope, effect } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { RootNode } from '../../types/internal'
import { NodeCreateEvent } from '../events.ts'

import type { BaseClip, Schema, Timeline } from './index.ts'
import { ParentNode } from './parent-node.ts'

type TrackType = 'video' | 'audio'

export class Track extends ParentNode<Schema.Track, BaseClip> {
  type = 'track' as const

  trackType: TrackType
  container = new Pixi.Container({ sortableChildren: true })
  declare parent?: Timeline

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

  constructor(init: Schema.Track, root: RootNode) {
    super(init.id, root)

    this.trackType = init.trackType

    this.#scope.run(() => {
      // connect clip nodes and transitions in the correct order
      effect((onCleanup) => {
        const clips = this.children
        clips.forEach((clip) => clip.connect())

        const disconnectClips = () => clips.forEach((clip) => clip.disconnect())
        onCleanup(disconnectClips)
      })

      // keep render order updated
      effect(() => {
        this.container.zIndex = this.index
      })
    })

    root.stage.addChild(this.container)

    this.onDispose(() => {
      this.#scope.stop()
      this.container.removeFromParent()
    })

    root._emit(new NodeCreateEvent(this))
  }

  toObject(): Schema.Track {
    return {
      id: this.id,
      type: this.type,
      trackType: this.trackType,
    }
  }
}
