import * as Comlink from 'comlink'
import * as kv from 'idb-keyval'

import {
  KeyParts,
  SUPPORTS_STORAGE,
  SUPPORTS_TRANSFERABLE_STREAM,
  WRITE_QUEUING_STRATEGY,
  WRITTEN_SIZE_UPDATE_INTERVAL_MS,
} from './constants.ts'
import type { FileStorageWorker, StorageWorkerFileInfo } from './storage-worker.ts'
import { getFileHandle } from './utils.ts'

let hasRequestedPersistence = false

const shouldRequestPersistence = async (): Promise<boolean> => {
  if (!SUPPORTS_STORAGE) return false

  if (await navigator.storage.persisted().catch(() => false)) return false

  try {
    if ('permissions' in navigator)
      return (await navigator.permissions.query({ name: 'persistent-storage' })).state === 'prompt'
  } catch {}

  return true
}

const requestPersistence = async () => {
  if (hasRequestedPersistence) return
  hasRequestedPersistence = true

  if (await shouldRequestPersistence()) navigator.storage.persist().catch(() => undefined)
}

export interface StorageFileWriteOptions extends StorageWorkerFileInfo {
  onProgress?: (progress: number) => void
  signal?: AbortSignal | null
}

const setProgressInterval = (key: string, options: StorageFileWriteOptions): (() => void) | undefined => {
  const { size, onProgress, signal } = options
  if (size == null || size === 0 || !onProgress) return

  let prev: number | null = null
  let cleared = false

  const handle = setInterval(() => {
    void kv.get<number | null>([key, KeyParts.CurrentSize]).then((current) => {
      if (cleared || signal?.aborted === true || current == null || current === prev) return
      onProgress((prev = current) / size)
    })
  }, WRITTEN_SIZE_UPDATE_INTERVAL_MS)

  return () => {
    if (cleared) return
    cleared = true
    clearInterval(handle)
  }
}

export class FileSystemStorage {
  worker!: Comlink.Remote<FileStorageWorker>
  #workerInstance!: Worker
  isDisposed = false

  constructor() {
    if (import.meta.env.SSR || import.meta.env.TEST === 'true') return

    const worker = new Worker(new URL('./storage-worker.ts', import.meta.url), {
      name: 'webgl-video-editor-storage',
      type: 'module',
    })
    this.#workerInstance = worker
    this.worker = Comlink.wrap<FileStorageWorker>(worker)
  }

  async getSink(key: string, options: StorageFileWriteOptions = {}): Promise<UnderlyingSink<Uint8Array>> {
    if (!hasRequestedPersistence) await requestPersistence()

    const sink = await this.worker.getSink(key, { size: options.size })

    return {
      async write(chunk) {
        await sink.write(Comlink.transfer(chunk, [chunk.buffer]))
      },
      async close() {
        await sink.close()
        sink[Comlink.releaseProxy]()
      },
      async abort() {
        await sink.abort()
        sink[Comlink.releaseProxy]()
      },
    }
  }

  async fromStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options: StorageFileWriteOptions,
  ): Promise<void> {
    if (!hasRequestedPersistence) await requestPersistence()

    const { signal } = options
    const stopProgressInterval = setProgressInterval(key, options)

    try {
      if (SUPPORTS_TRANSFERABLE_STREAM) {
        const { promise, abort } = await this.worker.fromStream(key, Comlink.transfer(stream, [stream]), {
          size: options.size,
        })

        signal?.addEventListener('abort', abort)
        await promise
        signal?.removeEventListener('abort', abort)
      } else {
        const writable = new WritableStream(await this.getSink(key, options), WRITE_QUEUING_STRATEGY)
        await stream.pipeTo(writable, signal ? { signal } : undefined)
      }

      if (!signal?.aborted) options.onProgress?.(1)
    } finally {
      stopProgressInterval?.()
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- TODO: per-instance directory?
  async get(key: string, name?: string, options?: FilePropertyBag): Promise<File> {
    const file = await (await getFileHandle(key)).getFile()
    return new File([file], name ?? file.name, options)
  }

  async hasCompleteFile(key: string): Promise<boolean> {
    return await this.worker.hasComplete(key)
  }

  async create(
    key: string,
    source: Blob | ReadableStream<Uint8Array>,
    options?: { signal?: AbortSignal | null; size?: number },
  ): Promise<void> {
    let stream
    let size = options?.size

    if ('size' in source && 'type' in source) {
      stream = source.stream()
      size ??= source.size
    } else stream = source

    await this.fromStream(key, stream, { size, signal: options?.signal })
  }

  async delete(key: string): Promise<void> {
    await this.worker.delete(key)
  }

  async deleteAll(): Promise<void> {
    await this.worker.deleteAll()
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    if (!import.meta.env.SSR && import.meta.env.TEST !== 'true') {
      this.worker[Comlink.releaseProxy]()
      this.#workerInstance.terminate()
    }

    this.worker = this.#workerInstance = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
