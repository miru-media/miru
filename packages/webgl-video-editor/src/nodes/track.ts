import { computed } from 'fine-jsx'

import type { AnyClip, AnyTrackChild } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'

import type { Schema } from './index.ts'
import { ParentNode } from './parent-node.ts'

export class Track extends ParentNode<Schema.Track, pub.Timeline, AnyTrackChild> implements pub.Track {
  type = 'track' as const

  trackType!: 'video' | 'audio'

  get firstClip(): AnyClip | undefined {
    const { head } = this
    if (head) return head.isClip() ? head : head.nextClip
  }
  get lastClip(): AnyClip | undefined {
    const { tail } = this
    if (tail) return tail.isClip() ? tail : tail.prevClip
  }

  get clips(): AnyClip[] {
    const clips: AnyClip[] = []
    for (let clip = this.firstClip; clip; clip = clip.nextClip) clips.push(clip)
    return clips
  }

  get clipCount(): number {
    return this.clips.length
  }

  readonly #duration = computed(() => {
    const { lastClip } = this
    if (!lastClip) return 0

    return lastClip.time.end
  })

  get duration(): number {
    return this.#duration.value
  }

  protected _init(init: Schema.Track): void {
    this.trackType = init.trackType
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTrack(): this is Track {
    return true
  }
  isVisual(): this is Track {
    return this.trackType === 'video'
  }
  isAudio(): this is Track {
    return this.trackType === 'audio'
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toObject(): Schema.Track {
    return {
      id: this.id,
      type: this.type,
      trackType: this.trackType,
    }
  }
}
