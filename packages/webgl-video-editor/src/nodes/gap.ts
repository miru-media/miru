import { Rational } from 'shared/utils/math.ts'

import type { ClipTimeRational, Schema } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'

import { TrackChild } from './track-child.ts'

export class Gap extends TrackChild<Schema.Gap> implements pub.Gap {
  declare readonly type: 'gap'
  declare readonly children: undefined
  declare readonly effects: never
  declare readonly color: undefined

  declare readonly transition: undefined

  _computeTimeRational(): ClipTimeRational {
    const prevTime = this.prev?.timeRational
    const start = prevTime ? prevTime.start.add(prevTime.duration) : Rational.ZERO
    const end = start.add(this.duration)

    const { duration } = this
    return { start, source: Rational.ZERO, duration, end }
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isGap(): this is Gap {
    return true
  }
  isTrackChild(): this is pub.AnyTrackChild {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.Gap {
    return { ...super.toJSON(), duration: this.duration }
  }
}
