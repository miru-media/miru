import * as Comlink from 'comlink'
import * as kv from 'idb-keyval'

import { KeyParts, SUPPORTS_WRITABLE_FILE_STREAM, WRITE_QUEUING_STRATEGY } from './constants'
import { byteCounter, deleteFile, getDir, getFileHandle, isFileComplete, kvStore } from './utils'

export interface StorageWorkerFileInfo {
  size?: number
}

const getFileHandleForOverwriting = async (
  key: string,
  options: StorageWorkerFileInfo,
): Promise<FileSystemFileHandle> => {
  const fileHandle = await getFileHandle(key, { create: true })

  await kv.setMany(
    [
      [[key, KeyParts.Complete], false],
      [[key, KeyParts.Size], options.size ?? null],
      [[key, KeyParts.CurrentSize], 0],
    ],
    kvStore,
  )

  return fileHandle
}

/**
 * Create a Writable underlying sink to write a file, replacing any existing content.
 */
class StorageWritableSink {
  readonly #key: string
  readonly #handlePromise: Promise<FileSystemSyncAccessHandle>
  #handle?: FileSystemSyncAccessHandle
  size: number | null
  #written = 0
  get written(): number {
    return this.#written
  }
  get progress(): number | null {
    const { size } = this
    return size == null || size === 0 ? null : this.#written / size
  }

  constructor(key: string, options: StorageWorkerFileInfo) {
    this.#key = key
    this.size = options.size ?? null

    this.#handlePromise = getFileHandleForOverwriting(key, options).then(async (fileHandle) => {
      const handle = await fileHandle.createSyncAccessHandle()
      // eslint-disable-next-line @typescript-eslint/await-thenable, @typescript-eslint/no-confusing-void-expression -- returns a promise in some older browser versions
      await handle.truncate(0)

      return (this.#handle = handle)
    })
  }

  async write(chunk: Uint8Array): Promise<void> {
    const handle = this.#handle ?? (await this.#handlePromise)
    const { byteLength } = chunk

    // eslint-disable-next-line @typescript-eslint/await-thenable -- returns a promise in some older browser versions
    await handle.write(chunk.buffer)

    this.#written += byteLength
  }

  #closeHandle(): void {
    if (this.#handle) this.#handle.close()
    else void this.#handlePromise.then((handle) => handle.close())
  }

  async close(): Promise<void> {
    this.#handle?.flush()
    const key = this.#key
    const size = this.size ?? this.#written

    await kv.setMany(
      [
        [[key, KeyParts.Complete], size === this.#written],
        [[key, KeyParts.Size], size],
        [[key, KeyParts.CurrentSize], size],
      ],
      kvStore,
    )

    this.#closeHandle()
  }

  async abort(): Promise<void> {
    this.#closeHandle()
    await fileStorage.delete(this.#key)
  }
}

/* eslint-disable @typescript-eslint/class-methods-use-this -- exposed singleton */
class FileStorage {
  getSink(key: string, options: StorageWorkerFileInfo): StorageWritableSink & Comlink.ProxyMarked {
    return Comlink.proxy(new StorageWritableSink(key, options))
  }

  async fromStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options: StorageWorkerFileInfo,
  ): Promise<{ promise: Promise<void>; abort: () => void }> {
    let writable: WritableStream<Uint8Array> | undefined

    const abort = new AbortController()

    if (SUPPORTS_WRITABLE_FILE_STREAM) {
      const fileHandle = await getFileHandleForOverwriting(key, options)
      const fileWritable = await fileHandle.createWritable()
      await fileWritable.truncate(0)
      writable = fileWritable
    } else writable = new WritableStream(new StorageWritableSink(key, options), WRITE_QUEUING_STRATEGY)

    let currentSize = 0
    const intervalHandle = setInterval(() => void kv.set([key, KeyParts.CurrentSize], currentSize, kvStore))

    const promise = stream
      .pipeThrough(byteCounter((total) => (currentSize = total)))
      .pipeTo(writable, { signal: abort.signal })
      .then(() =>
        kv.setMany(
          [
            [[key, KeyParts.Complete], true],
            [[key, KeyParts.Size], currentSize],
            [[key, KeyParts.CurrentSize], currentSize],
          ],
          kvStore,
        ),
      )
      .finally(() => {
        clearInterval(intervalHandle)
      })

    return Comlink.proxy({ promise, abort: abort.abort.bind(abort) })
  }

  async deleteFile(key: string): Promise<void> {
    await deleteFile(key)
  }

  async hasCompleteFile(key: string): Promise<boolean> {
    return await isFileComplete(key)
  }

  async delete(key: string): Promise<void> {
    await Promise.all([
      kv.delMany(
        [
          [key, KeyParts.Complete],
          [key, KeyParts.Size],
          [key, KeyParts.CurrentSize],
        ],
        kvStore,
      ),
      deleteFile(key),
    ])
  }

  async deleteAll(): Promise<void> {
    await Promise.all([
      getDir()
        .then(async (dir) => {
          const names = (dir as FileSystemDirectoryHandle & { keys: () => AsyncIterable<string> }).keys()
          for await (const name of names) await dir.removeEntry(name)
        })
        .catch(() => undefined),
      kv.clear(kvStore),
    ])
  }
}
/* eslint-enable @typescript-eslint/class-methods-use-this */

const fileStorage = new FileStorage()

Comlink.expose(fileStorage)

export type { FileStorage }
