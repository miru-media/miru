import { cubicBezier } from '@motionone/easing'
import * as colorjs from 'colorjs.io/fn'
import easingsFunctions from 'easings.net'
import { computed } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import { clamp, lerp, Rational, remap } from 'shared/utils/index.ts'

import { defineComputedProp, NodePropList } from '../nodes/utils.ts'

import { Keyframe } from './keyframe.ts'

export const identity = <T>(v: T) => v

export type EasingType = keyof typeof easingsFunctions

const compareTimeToKeyframe = (keyframe: Keyframe, time: Schema.Rational): number =>
  Rational.compare(keyframe.time, time)

colorjs.ColorSpace.register(colorjs.sRGB)

class AnimationView<T = unknown> {
  #animation: Animation<T>
  #time: () => Rational

  readonly #from = computed(() =>
    this.isDisposed ? undefined : this.#animation.getKeyframeFor(this.#time()),
  )
  declare ease: ((t: Rational) => T) | undefined

  isDisposed = false

  constructor(animation: Animation<T>, time: () => Rational) {
    this.#time = time
    this.#animation = animation

    defineComputedProp(this, 'ease', () => {
      const from = this.#from.value
      if (!from) return

      const { easing } = from
      const to = from.next
      if (!to) return () => from.value

      const ease = Array.isArray(easing)
        ? cubicBezier(...(easing as Schema.CubicBezierPoints))
        : ((typeof easing === 'string' ? easingsFunctions[easing] : undefined) ?? ((t) => t))

      const fromTime = from.time.valueOf()
      const toTime = to.time.valueOf()

      let interpolate: (time: number) => T

      if (this.#animation.isColor()) {
        const colorRange = colorjs.range(
          colorjs.parse(from.value as string),
          colorjs.parse(to.value as string),
          { progression: ease },
        )
        interpolate = (time) => colorjs.serialize(colorRange(time)) as T
      } else
        interpolate = (progress: number) =>
          lerp(from.value as number, to.value as number, ease(progress)) as T

      return (time: Rational) => interpolate(clamp(remap(time.valueOf(), fromTime, toTime, 0, 1), 0, 1))
    })
  }

  getValue(): T | undefined {
    return this.ease?.(this.#time())
  }

  dispose(): void {
    this.isDisposed = true
    this.#time = this.#animation = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}

export type { AnimationView }

export class Animation<T = unknown> implements pub.Animation<T> {
  readonly #dll: NodePropList<Keyframe<T>>
  readonly flags: number

  get keyframes(): Keyframe<T>[] {
    return this.#dll.array.value
  }

  createView(time: () => Rational): AnimationView<T> {
    return new AnimationView(this, time)
  }

  constructor(flags: number, emitAction: (action: pub.NodeListChangeEvent.Action) => void) {
    this.#dll = new NodePropList(emitAction)
    this.flags = flags
  }

  isColor(): boolean {
    return (this.flags & NODE_FIELD_FLAGS.Color) !== 0
  }

  canInterpolate(): boolean {
    return !!this.#dll.head?.next
  }

  indexOfKeyframeAt(time: Schema.Rational): number {
    return this.#dll.search(compareTimeToKeyframe, time)
  }

  getKeyframeAt(time: Schema.Rational): Keyframe<T> | undefined {
    const index = this.indexOfKeyframeAt(time)
    return index >= 0 ? this.keyframes[index] : undefined
  }

  getKeyframeFor(time: Schema.Rational): Keyframe<T> | undefined {
    if (!this.#dll.head) return

    const { keyframes } = this
    const index = this.indexOfKeyframeAt(time)

    return keyframes[clamp(index >= 0 ? index : -index - 2, 0, keyframes.length - 1)]
  }

  createAtTime(value: T, time: Rational, _index?: number): void {
    const keyframe = new Keyframe({
      value,
      dt: Rational.ZERO,
      easing: 'linear',
    })

    let newIndex = _index ?? this.indexOfKeyframeAt(time)
    if (newIndex < 0) newIndex = -(newIndex + 1) + 0

    const prev = this.keyframes.at(newIndex - 1)
    const next = this.keyframes.at(newIndex)

    keyframe.dt = time.subtract(prev?.time ?? Rational.ZERO)

    this.#dll.insert(newIndex, keyframe)

    if (next && keyframe.dt.value)
      this.#dll.update(next.index, 'dt', Rational.from(next.dt).subtract(keyframe.dt))
  }

  updateOrCreateAtTime(value: T, time: Rational, _index?: number): void {
    const index = this.indexOfKeyframeAt(time)

    if (index >= 0) this.#dll.update(index, 'value', value)
    else this.createAtTime(value, time, index)
  }

  insert(index: number, keyframe: pub.Keyframe<T>): void {
    this.#dll.insert(index, keyframe)
  }

  update<K extends keyof pub.Keyframe<T>>(index: number, key: K, value: pub.Keyframe<T>[K]): void {
    this.#dll.update(index, key, value)
  }

  delete(index: number): void {
    const keyframe = this.keyframes[index]
    const { dt, next } = keyframe
    this.#dll.delete(index)
    if (next) this.update(next.index, 'dt', Rational.from(next.dt).add(dt))
  }

  pushInitial(keyframe: pub.Keyframe<T>): void {
    this.#dll._push(keyframe)
  }

  splitAt(time: pub.Rational):
    | {
        sliceTo: Keyframe<T> | undefined
        sliceToIndex: number
        isOnKeyframe: boolean
        splitValue: T
      }
    | undefined {
    if (!this.#dll.head) return

    const index = this.indexOfKeyframeAt(time)
    const sliceToIndex = index >= 0 ? index : -index - 1 + 0
    const keyframeForTime = this.keyframes.at(index >= 0 ? index : -index - 1)

    const isOnKeyframe = !!keyframeForTime && keyframeForTime.time.isEqualTo(time)
    let splitValue

    if (isOnKeyframe) splitValue = keyframeForTime.value
    else {
      const view = this.createView(() => time)
      splitValue = view.getValue()!
      view.dispose()
    }

    if (isOnKeyframe) return { sliceTo: keyframeForTime, sliceToIndex, splitValue, isOnKeyframe }

    return { sliceTo: keyframeForTime, sliceToIndex, splitValue, isOnKeyframe }
  }

  toJSON(): pub.Schema.Animation<T> | undefined {
    const keyframes = this.#dll.toJSON()
    return keyframes && { keyframes }
  }

  dispose(): void {
    this.#dll.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
