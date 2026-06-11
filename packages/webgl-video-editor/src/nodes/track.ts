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
    { key: 'duration', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.Track>[])

  trackType!: 'video' | 'audio'

  readonly #duration = computed(() => this.tail?.timeRational.end ?? Rational.ZERO)

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
