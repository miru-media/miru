import type { Keyframe, Rational } from '#core'
import type * as Schema from '#schema'

export interface Animation<T = unknown> {
  readonly keyframes: Keyframe<T>[]
  readonly flags: number
  createView: (getTime: () => Rational) => {
    getValue: () => T | undefined
    dispose: () => void
    [Symbol.dispose]: () => void
  }
  canInterpolate: () => boolean
  indexOfKeyframeAt: (time: Schema.Rational) => number
  getKeyframeAt: (time: Schema.Rational) => Keyframe<T> | undefined
  getKeyframeFor: (time: Schema.Rational) => Keyframe<T> | undefined
  createAtTime: (value: T, time: Rational, index?: number) => void
  updateOrCreateAtTime: (value: T, time: Rational, index?: number) => void
  insert: (index: number, keyframe: Keyframe<T>) => void
  update: <K extends keyof Keyframe<T>>(index: number, key: K, value: Keyframe<T>[K]) => void
  delete: (index: number) => void
  pushInitial: (keyframe: Keyframe<T>) => void
  splitAt: (time: Rational) =>
    | {
        sliceTo: Keyframe<T> | undefined
        sliceToIndex: number
        isOnKeyframe: boolean
        splitValue: T
      }
    | undefined
  toJSON: () => Schema.Animation<T> | undefined
  dispose: () => void
  [Symbol.dispose]: () => void
}

export interface Keyframe<T> {
  value: T
  dt: Rational | Schema.Rational
  easing: Schema.EasingOption | undefined

  prev: Keyframe<T> | undefined
  next: Keyframe<T> | undefined

  readonly index: number
  readonly time: Rational

  toJSON: () => Schema.Keyframe<T>
}
