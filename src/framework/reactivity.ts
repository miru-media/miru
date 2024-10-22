import { autoStabilize, Reactive, reactive as reactive_ } from '@reactively/core'

import { isFunction } from '../utils/general'

// https://github.com/milomg/reactively/issues/15
autoStabilize()

let currentScope: EffectScope | undefined

export const getCurrentScope = () => currentScope

export class EffectScope {
  _cleanups = new Set<() => void>()
  active = true

  constructor(detached = false) {
    if (detached || currentScope == undefined) return

    const parent = currentScope

    const onParentDispose = this.stop.bind(this)
    parent._cleanups.add(onParentDispose)
    this._cleanups.add(() => parent._cleanups.delete(onParentDispose))
  }

  run<T>(fn: () => T) {
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV && !this.active) console.warn(`[miru] can't run in stopped scope`)

    const prevScope = currentScope
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    currentScope = this

    try {
      return fn()
    } finally {
      currentScope = prevScope
    }
  }

  stop() {
    // eslint-disable-next-line no-console
    if (import.meta.env.DEV && !this.active) console.warn('[miru] trying to stop already stopped EffectScope')

    const cleanups = this._cleanups

    cleanups.forEach((fn) => {
      cleanups.delete(fn)
      fn()
    })
    cleanups.clear()
    this.active = false
  }
}

/**
 * More or less Vue's ref()
 */
export interface Ref<T = unknown> {
  value: T
}

class RefImpl<T = unknown> implements Ref {
  _v = reactive_<any>(undefined)
  /** is function value */
  _f!: boolean
  /** is from computed reactive value */
  _r!: boolean

  __m_isRef = true

  get value(): T {
    const value = this._v.value
    return this._f ? value.v : value
  }
  set value(value: T) {
    this._set(value)
  }

  constructor(value: T | Reactive<T>) {
    if (value instanceof Reactive) {
      this._v = value
      this._r = true
    } else this._set(value)
  }

  private _set(value: T) {
    if (this._r) throw new Error(`[miru] Can't set computed value`)

    if (isFunction(value)) {
      this._f = true
      this._v.value = { v: value }
    } else {
      this._f = false
      this._v.value = value
    }
  }
}

export function ref<T>(): Ref<T | undefined>
export function ref<T>(initialValue: T): Ref<T>
export function ref<T>(initialValue?: T) {
  return new RefImpl(initialValue)
}

export const computed = <T>(getter: () => T, equals?: (a: T, b: T | undefined) => boolean): Ref<T> => {
  const reactive = reactive_(getter, { equals })

  currentScope?._cleanups.add(() => ((reactive as unknown as { fn?: typeof getter }).fn = undefined))

  return new RefImpl(reactive)
}

export type MaybeRef<T = unknown> = Ref<T> | T
export type MaybeRefOrGetter<T = unknown> = MaybeRef<T> | Reactive<T> | (() => T)

export const isRef = <T>(source: Ref<T> | T | object): source is Ref<T> => {
  return source != undefined && (source as RefImpl).__m_isRef
}

export const toValue = <T>(source: MaybeRefOrGetter<T>): T => {
  if (isRef(source)) return source.value
  if (isFunction(source)) return source()
  if (source instanceof Reactive) return source.value as T
  return source
}

export const toRef = <T>(value: MaybeRefOrGetter<T>): Ref<T> => {
  if (isRef(value)) return value
  if (isFunction(value)) return computed(value)
  if (value instanceof Reactive) return new RefImpl(value)
  return ref(value)
}

export const createEffectScope = () => new EffectScope()

export const onScopeDispose = (fn: () => void) => {
  currentScope?._cleanups.add(fn)
}

type WatchSource<T = unknown> = Ref<T> | Reactive<T> | (() => T)

type MapSources<T, IsPrev extends boolean = false> = {
  [K in keyof T]: T[K] extends WatchSource<infer V> ? V | (IsPrev extends true ? undefined : never) : never
}

type OnCleanup = (callback: () => void) => void

const ON_STOP = Symbol('miru-on-stop')

/**
 * A lot like Vue's `watch(source, callback)`, except it can only take an array of sources.
 *
 * @example
 * watch([ref(2), () => somethingElse], ([fist, second], _prev, onCleanup) => {
 *   ...
 * })
 */
export const watch = <Sources extends readonly WatchSource[]>(
  sources: [...Sources],
  callback: (
    current: MapSources<Sources>,
    previous: MapSources<Sources, true>,
    onCleanup: OnCleanup,
  ) => unknown,
) => {
  let cleanup: (() => void) | undefined
  const onCleanup: OnCleanup = (callback) => (cleanup = callback)

  let prev: MapSources<Sources, true> | undefined

  return effectInternal(
    () => {
      const cur = sources.map(toValue) as MapSources<Sources>

      if (prev != undefined) {
        let changed = false

        for (let i = 0; i < cur.length; i++) {
          if (cur[i] === prev[i]) continue
          changed = true
          break
        }

        if (!changed) return
      } else {
        prev = Array.from({ length: cur.length }) as MapSources<Sources, true>
      }

      cleanup?.()
      cleanup = undefined
      callback(cur, prev, onCleanup)
      prev = cur
    },
    { [ON_STOP]: () => cleanup?.() },
  )
}

const effectInternal = (
  callback: (onCleanup: OnCleanup) => void,
  hooks: Record<symbol, (() => void) | undefined>,
) => {
  const scope = currentScope
  if (scope != undefined && !scope.active) throw new Error(`[miru] Scope is already disposed`)

  let cleanup: (() => void) | undefined
  const onCleanup: OnCleanup = (callback) => (cleanup = callback)

  const r = reactive_(
    () => {
      cleanup?.()
      cleanup = undefined

      callback(onCleanup)
    },
    { effect: true },
  )
  r.get()
  const stopReactive = () => (r.value = undefined as never)

  const stop = () => {
    scope?._cleanups.delete(stop)
    stopReactive()
    hooks[ON_STOP]?.()
  }

  scope?._cleanups.add(stop)

  return stop
}

/**
 * A lot like Vue's `watchEffect(callback)`
 */
export const effect = (callback: (onCleanup: OnCleanup) => void) => effectInternal(callback, {})
