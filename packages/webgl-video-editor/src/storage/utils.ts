import * as kv from 'idb-keyval'

import { DB_NAME, DIRNAME, KeyParts, STORE_NAME, SUPPORTS_STORAGE } from './constants'

export const kvStore = kv.createStore(DB_NAME, STORE_NAME)

const rootDir = SUPPORTS_STORAGE ? navigator.storage.getDirectory() : undefined
const dir = rootDir?.then((root) => root.getDirectoryHandle(DIRNAME, { create: true }))

export const getRootDir = async (): Promise<FileSystemDirectoryHandle | undefined> => await rootDir
export const getDir = async (): Promise<FileSystemDirectoryHandle> =>
  (await dir) ?? (await Promise.reject(new Error(`Can't access private origin directory.`)))

export const getFileHandle = async (
  key: string,
  options?: FileSystemGetFileOptions,
): Promise<FileSystemFileHandle> => await (await getDir()).getFileHandle(key, options)

export const isFileComplete = async (key: string): Promise<boolean> => {
  let hasFullFile = false

  try {
    const [complete, size, currentSize] = await kv.getMany<boolean | number | null>(
      [
        [key, KeyParts.Complete],
        [key, KeyParts.Size],
        [key, KeyParts.CurrentSize],
      ],
      kvStore,
    )

    hasFullFile = complete === true && size != null && size === currentSize
  } catch {}

  return hasFullFile
}

export const deleteFile = async (key: string): Promise<void> => await (await getDir()).removeEntry(key)

export const byteCounter = (callback: (total: number) => void) => {
  let total = 0

  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk)
      total += chunk.byteLength
      callback(total)
    },
  })
}
