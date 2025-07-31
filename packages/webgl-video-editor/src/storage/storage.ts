import * as Comlink from 'comlink'
import * as kv from 'idb-keyval'

import {
  KeyParts,
  SUPPORTS_STORAGE,
  SUPPORTS_TRANSFERABLE_STREAM,
  WRITE_QUEUING_STRATEGY,
  WRITTEN_SIZE_UPDATE_INTERVAL_MS,
} from './constants'
import type { FileStorage, StorageWorkerFileInfo } from './storage-worker'
import { getFileHandle } from './utils'

let hasRequestedPersistence = false
let storage_: Comlink.Remote<FileStorage>

if (!import.meta.env.SSR) {
  const worker = new Worker(new URL('./storage-worker.js', import.meta.url), {
    name: 'webgl-video-editor-storage',
    type: 'module',
  })
  storage_ = Comlink.wrap<FileStorage>(worker)
}

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

interface StorageFileWriteOptions extends StorageWorkerFileInfo {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
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

const getSink = async (
  key: string,
  options: StorageFileWriteOptions = {},
): Promise<UnderlyingSink<Uint8Array>> => {
  if (!hasRequestedPersistence) await requestPersistence()

  const sink = await storage_.getSink(key, { size: options.size })

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

export const storage = {
  async fromStream(key: string, stream: ReadableStream<Uint8Array>, options: StorageFileWriteOptions) {
    if (!hasRequestedPersistence) await requestPersistence()

    const { signal } = options
    const stopProgressInterval = setProgressInterval(key, options)

    try {
      if (SUPPORTS_TRANSFERABLE_STREAM) {
        const { promise, abort } = await storage_.fromStream(key, Comlink.transfer(stream, [stream]), {
          size: options.size,
        })

        signal?.addEventListener('abort', abort)
        await promise
        signal?.removeEventListener('abort', abort)
      } else {
        const writable = new WritableStream(await getSink(key, options), WRITE_QUEUING_STRATEGY)
        await stream.pipeTo(writable, { signal })
      }

      if (!signal?.aborted) options.onProgress?.(1)
    } finally {
      stopProgressInterval?.()
    }
  },

  async getFile(key: string, name?: string, options?: FilePropertyBag): Promise<File> {
    const file = await (await getFileHandle(key)).getFile()
    return new File([file], name ?? file.name, options)
  },

  async hasCompleteFile(key: string): Promise<boolean> {
    return await storage_.hasCompleteFile(key)
  },

  async delete(key: string): Promise<void> {
    await storage_.delete(key)
  },

  async deleteAll(): Promise<void> {
    await storage_.deleteAll()
  },
}
