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

interface DevSlowDown {
  (): Promise<undefined>
  <T>(value: T | PromiseLike<T>): Promise<T>
}

const VITE_DEV_SLOW_DOWN_MS =
  (!!import.meta.env.VITE_DEV_SLOW_DOWN_MS && parseInt(import.meta.env.VITE_DEV_SLOW_DOWN_MS)) || 0
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
  str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase())
