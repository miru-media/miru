export class Janitor {
  private _onDispose = new Set<() => void>()
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

  setTimeout(() => URL.revokeObjectURL(anchor.href), 60_000)
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const isFunction = (value: unknown): value is Function => typeof value === 'function'

export const asArray = <T>(value: T | T[]) => (Array.isArray(value) ? value : [value])

export const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const isElement = (value: unknown): value is Element =>
  value != null && typeof value === 'object' && 'nodeType' in value && value.nodeType === 1

interface DevSlowDown {
  (): Promise<undefined>
  <T>(value: T | PromiseLike<T>): Promise<T>
}

const VITE_DEV_SLOW_DOWN_MS =
  (import.meta.env.VITE_DEV_SLOW_DOWN_MS != null && parseInt(import.meta.env.VITE_DEV_SLOW_DOWN_MS)) || 0
const slowResolveQueue: (() => void)[] = /* @__PURE__ */ []
const setResolveTimeout = () =>
  setTimeout(() => {
    slowResolveQueue.pop()!()
    if (slowResolveQueue.length) setResolveTimeout()
  }, VITE_DEV_SLOW_DOWN_MS)

export const devSlowDown: DevSlowDown | undefined = VITE_DEV_SLOW_DOWN_MS
  ? async <T>(value?: T | PromiseLike<T>) => {
      if (!slowResolveQueue.length) setResolveTimeout()

      await new Promise<void>((resolve) => slowResolveQueue.push(resolve))
      return value
    }
  : undefined

// https://stackoverflow.com/a/63116134
export const toKebabCase = (str: string) =>
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase())

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
