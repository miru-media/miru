import { computed, ref, type Ref } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type * as Schema from '#schema'
import { Rational } from 'shared/utils/math.ts'

import { NodeGapUpdateEvent } from '../events.ts'

import { BaseNode } from './base-node.ts'
import type { Track } from './track.ts'

export abstract class TrackChild<T extends Schema.TrackChild> extends BaseNode<T, Track> {
  static FIELDS = super.FIELDS.concat([
    { key: 'duration', flags: 0, transform: Rational.from },

    { key: 'timeRational', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'time', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.TrackChild>[])

  declare duration: Rational

  /**
   * A map whose keys are the IDs of track children and the value is the duration of the gap when the
   * referenced clip preceeds this one. The empty string is used when the node is the first child of the
   * parent.
   */
  declare _gaps: Record<string, Ref<Rational>>

  declare private _timeRational: Ref<pub.ClipTimeRational>
  declare private _time: Ref<pub.ClipTime>

  get timeRational(): pub.ClipTimeRational {
    return this._timeRational.value
  }
  get time(): pub.ClipTime {
    return this._time.value
  }

  get gap(): Rational {
    return this._gaps[this.prev?.id ?? ''].value
  }
  set gap(duration: Schema.Rational) {
    const prevClipId = this.prev?.id ?? ''
    this.setGap(prevClipId, duration)
  }

  get ['prev' as never](): this['prev'] {
    // @ts-expect-error -- types don't declare the prop as a getter/setter, but it is
    return super.prev
  }
  set ['prev' as never](newPrev: this['prev']) {
    const prevClipId = newPrev?.id ?? ''
    // ensure that a gap duration entry exists for the new position
    this._gaps[prevClipId] ??= ref(Rational.ZERO)

    // @ts-expect-error -- same as getter
    super.prev = newPrev
  }

  getGap(prevClipId: string | undefined = ''): Rational {
    return this._gaps[prevClipId].value
  }

  setGap(prevClipId: string | undefined = '', duration: Schema.Rational): void {
    const gapRef = (this._gaps[prevClipId] ??= ref(Rational.ZERO))
    const oldValue = gapRef.value
    if (oldValue.isEqualTo(duration)) return

    gapRef.value = Rational.from(duration)
    this.doc.emit(new NodeGapUpdateEvent(this as unknown as pub.AnyClip, prevClipId, oldValue))
  }

  protected _init(): void {
    this._gaps = { '': ref(Rational.ZERO) }
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
