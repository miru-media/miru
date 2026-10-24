export class Janitor {
  private readonly _onDispose = new Set<() => void>()
  isDisposed = false

  add(fn: () => void) {
    this._onDispose.add(fn)
  }

  dispose() {
    this._onDispose.forEach((fn) => fn())
    this._onDispose.clear()
    this.isDisposed = true
  }
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const anchor = document.createElement('a')
  const url = URL.createObjectURL(blob)

  anchor.href = url
  anchor.target = '_blank'
  anchor.download = fileName
  anchor.dispatchEvent(new MouseEvent('click'))

  URL.revokeObjectURL(anchor.href)
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed for type narrowing
export const isFunction = (value: unknown): value is Function => typeof value === 'function'

export const asArray = <T>(value: T | T[]) => (Array.isArray(value) ? value : [value])

export const timeout = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export const isElement = (value: unknown): value is Element =>
  value != null && typeof value === 'object' && 'nodeType' in value && value.nodeType === 1

interface DevSlowDown {
  (): Promise<undefined>
  <T>(value: T | PromiseLike<T>): Promise<T>
}

const VITE_DEV_SLOW_DOWN_MS =
  /* @__PURE__ */ (import.meta.env.VITE_DEV_SLOW_DOWN_MS != null &&
    parseInt(import.meta.env.VITE_DEV_SLOW_DOWN_MS, 10)) ||
  0
const slowResolveQueue: (() => void)[] = /* @__PURE__ */ []
const setResolveTimeout = () =>
  setTimeout(() => {
    slowResolveQueue.pop()!()
    if (slowResolveQueue.length) setResolveTimeout()
  }, VITE_DEV_SLOW_DOWN_MS)

export const devSlowDown: DevSlowDown | undefined = /* @__PURE__ */ VITE_DEV_SLOW_DOWN_MS
  ? async <T>(value?: T | PromiseLike<T>) => {
      if (!slowResolveQueue.length) setResolveTimeout()

      await new Promise<void>((resolve) => {
        slowResolveQueue.push(resolve)
      })
      return await value
    }
  : undefined

// https://stackoverflow.com/a/63116134
export const toKebabCase = (str: string) =>
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- brevity
  str.replace(/[A-Z]+(?![a-z])|[A-Z]/gu, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase())

// https://stackoverflow.com/a/7616484
export const stringHashCode = (str: string) => {
  let hash = 0
  let i
  let chr

  if (str.length === 0) return hash
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

export const promiseWithResolvers = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_
    reject = reject_
  })

  return { promise, resolve, reject }
}

/*
 * Binary search in JavaScript. Returns the index of of the element in a sorted array or (-n-1) where n is the
 * insertion point for the new element
 *
 * Adapted from https://stackoverflow.com/a/29018745
 */
export const binarySearch: {
  <T, U = T>(
    array: ArrayLike<T>,
    comparator: (a: T, b: U) => number,
    element: U,
    from?: number,
    to?: number,
  ): number
  <T>(
    array: ArrayLike<T>,
    comparator: (a: T) => number,
    element?: undefined,
    from?: number,
    to?: number,
  ): number
} = <T, U = T>(
  array: ArrayLike<T>,
  comparator: (a: T, b: U | undefined) => number,
  element?: U,
  from = 0,
  to = array.length - 1,
  // eslint-disable-next-line @typescript-eslint/max-params -- internal
): number => {
  let m = from
  let n = to

  while (m <= n) {
    const k = (n + m) >> 1
    const cmp = comparator(array[k], element)

    if (cmp < 0) m = k + 1
    else if (cmp > 0) n = k - 1
    else return k
  }

  return -m - 1
}
