import { computed, type Ref } from 'fine-jsx'

import type { AnyClip, ClipTime, ClipTimeRational, Schema } from '#core'
import { Rational } from 'shared/utils/math.ts'

import { BaseNode } from './base-node.ts'
import type { Track } from './track.ts'

export abstract class TrackChild<T extends Schema.TrackChild> extends BaseNode<T, Track> {
  declare duration: Rational

  declare private _timeRational: Ref<ClipTimeRational>
  declare private _time: Ref<ClipTime>

  get timeRational(): ClipTimeRational {
    return this._timeRational.value
  }
  get time(): ClipTime {
    return this._time.value
  }

  get prevClip(): AnyClip | undefined {
    for (let other = this.prev; other; other = other.prev) if (other.isClip()) return other
  }
  get nextClip(): AnyClip | undefined {
    for (let other = this.next; other; other = other.next) if (other.isClip()) return other
  }

  protected _init(init: T): void {
    this._defineReactive('duration', init.duration, { transform: Rational.from })

    this._timeRational = computed(() => this._computeTimeRational())
    this._time = computed(() => TrackChild.clipTimeRationalToDecimal(this.timeRational))
  }

  abstract _computeTimeRational(): ClipTimeRational

  static clipTimeRationalToDecimal(timeRational: ClipTimeRational): ClipTime {
    return {
      start: timeRational.start.valueOf(),
      source: timeRational.source.valueOf(),
      duration: timeRational.duration.valueOf(),
      end: timeRational.end.valueOf(),
    }
  }
}
