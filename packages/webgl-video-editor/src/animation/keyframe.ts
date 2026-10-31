import type * as pub from '#core'
import type { Schema } from '#core'
import { Rational } from 'shared/utils'

import { defineComputedProp, defineReactiveProp, DLLNode } from '../nodes/utils.ts'

export class Keyframe<T = unknown> extends DLLNode implements pub.Keyframe<T> {
  declare value: T
  declare dt: Rational | Schema.Rational
  declare easing: Schema.EasingOption | undefined

  declare time: Rational

  constructor(init: Schema.Keyframe<T>) {
    super()
    defineReactiveProp(this, 'value', init.value)
    defineReactiveProp(this, 'dt', Rational.from(init.dt))
    defineReactiveProp(this, 'easing', init.easing)

    defineComputedProp(
      this,
      'time',
      () => Rational.from(this.dt).add(this.prev?.time ?? Rational.ZERO),
      Rational.equals,
    )
  }

  toJSON(): Schema.Keyframe<T> {
    const { value, dt, easing } = this
    return { value, dt: { value: dt.value, rate: dt.rate }, easing }
  }
}
