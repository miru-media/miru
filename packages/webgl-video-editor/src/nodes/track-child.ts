import { computed, type Ref } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type * as Schema from '#schema'
import { Rational } from 'shared/utils/math.ts'

import { BaseNode } from './base-node.ts'
import type { Track } from './track.ts'

export abstract class TrackChild<T extends Schema.TrackChild> extends BaseNode<T, Track> {
  static FIELDS = super.FIELDS.concat([
    { key: 'duration', flags: 0, transform: Rational.from },

    { key: 'timeRational', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'time', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'prevClip', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'nextClip', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
  ] satisfies pub.NodeFieldDef<pub.TrackChild>[])

  declare duration: Rational

  declare private _timeRational: Ref<pub.ClipTimeRational>
  declare private _time: Ref<pub.ClipTime>

  get timeRational(): pub.ClipTimeRational {
    return this._timeRational.value
  }
  get time(): pub.ClipTime {
    return this._time.value
  }

  get prevClip(): pub.AnyClip | undefined {
    for (let other = this.prev; other; other = other.prev) if (other.isClip()) return other
  }
  get nextClip(): pub.AnyClip | undefined {
    for (let other = this.next; other; other = other.next) if (other.isClip()) return other
  }

  protected _init(): void {
    this._timeRational = computed(() => this._computeTimeRational())
    this._time = computed(() => TrackChild.clipTimeRationalToDecimal(this.timeRational))
  }

  abstract _computeTimeRational(): pub.ClipTimeRational

  static clipTimeRationalToDecimal(timeRational: pub.ClipTimeRational): pub.ClipTime {
    return {
      start: timeRational.start.valueOf(),
      source: timeRational.source.valueOf(),
      duration: timeRational.duration.valueOf(),
      end: timeRational.end.valueOf(),
    }
  }
}
