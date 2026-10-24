import type * as pub from '#core'
import type { Schema } from '#core'
import { Rational } from 'shared/utils'

import { defineComputedProp, defineReactiveProp } from '../nodes/utils.ts'

export class Keyframe<T = unknown> implements pub.Keyframe<T> {
  declare value: T
  declare dt: Rational | Schema.Rational
  declare easing: Schema.EasingOption | undefined

  declare prev: this | undefined
  declare next: this | undefined
  declare index: number

  declare time: Rational

  constructor(init: Schema.Keyframe<T>) {
    defineReactiveProp(this, 'value', init.value)
    defineReactiveProp(this, 'dt', Rational.from(init.dt))
    defineReactiveProp(this, 'easing', init.easing)

    defineReactiveProp(this, 'prev')
    defineReactiveProp(this, 'next')
    defineComputedProp(this, 'index', () => (this.prev ? this.prev.index + 1 : 0))
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
