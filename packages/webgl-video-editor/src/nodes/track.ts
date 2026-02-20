import { computed, createEffectScope } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type { RootNode } from '../../types/internal'
import { NodeCreateEvent } from '../events.ts'

import type { BaseClip, Gap, Schema, Timeline } from './index.ts'
import { ParentNode } from './parent-node.ts'

export namespace Track {
  export type TrackType = 'video' | 'audio'
}

export class Track extends ParentNode<Schema.Track, Timeline, BaseClip | Gap> {
  type = 'track' as const

  trackType: Track.TrackType
  container = new Pixi.Container({ sortableChildren: true })

  readonly #scope = createEffectScope()

  get firstClip(): BaseClip | undefined {
    const { head } = this
    if (head) return head.isClip() ? head : head.nextClip
  }
  get lastClip(): BaseClip | undefined {
    const { tail } = this
    if (tail) return tail.isClip() ? tail : tail.prevClip
  }

  get clips(): BaseClip[] {
    const clips: BaseClip[] = []
    for (let clip = this.firstClip; clip; clip = clip.nextClip) clips.push(clip)
    return clips
  }

  readonly #duration = computed(() => {
    const { lastClip } = this
    if (!lastClip) return 0

    return lastClip.time.end
  })

  get duration(): number {
    return this.#duration.value
  }

  constructor(init: Schema.Track, root: RootNode) {
    super(init.id, root)

    this.trackType = init.trackType

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
