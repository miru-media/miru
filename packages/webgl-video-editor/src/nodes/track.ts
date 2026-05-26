import { computed } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import type { NonOverlappingUnion } from '#internal'
import { Rational } from 'shared/utils/math.ts'

import { ParentNode } from './parent-node.ts'

export interface Track extends NonOverlappingUnion<
  ParentNode<Schema.Track, pub.Timeline, pub.AnyTrackChild>,
  pub.Track
> {}

export class Track extends ParentNode<Schema.Track, pub.Timeline, pub.AnyTrackChild> implements pub.Track {
  static FIELDS = super.FIELDS.concat([
    { key: 'trackType', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'firstClip', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'lastClip', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'clips', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.NodeArray },
    { key: 'clipCount', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'duration', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.Track>[])

  trackType!: 'video' | 'audio'

  get firstClip(): pub.AnyClip | undefined {
    const { head } = this
    if (head) return head.isClip() ? head : head.nextClip
  }
  get lastClip(): pub.AnyClip | undefined {
    const { tail } = this
    if (tail) return tail.isClip() ? tail : tail.prevClip
  }

  get clips(): pub.AnyClip[] {
    const clips: pub.AnyClip[] = []
    for (let clip = this.firstClip; clip; clip = clip.nextClip) clips.push(clip)
    return clips
  }

  get clipCount(): number {
    return this.clips.length
  }

  readonly #duration = computed(() => {
    const { lastClip } = this
    if (!lastClip) return Rational.ZERO

    return lastClip.timeRational.end
  })

  get duration(): Rational {
    return this.#duration.value
  }

  protected _init(init: Schema.Track): void {
    this.trackType = init.trackType
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTrack(): this is Track {
    return true
  }
  isVideo(): this is pub.VideoTrack {
    return this.trackType === 'video'
  }
  isAudio(): this is pub.AudioTrack {
    return this.trackType === 'audio'
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.Track {
    return {
      ...super.toJSON(),
      trackType: this.trackType,
    }
  }
}
