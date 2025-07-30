export const DIRNAME = 'webgl-video-editor'
export const DB_NAME = 'webgl-video-editor-kv-db'
export const STORE_NAME = 'kv-store'

export const WRITE_QUEUING_STRATEGY = new ByteLengthQueuingStrategy({ highWaterMark: 1048576 })

export const WRITTEN_SIZE_UPDATE_INTERVAL_MS = 125

export let SUPPORTS_TRANSFERABLE_STREAM = false

if (!import.meta.env.SSR) {
  try {
    const channel = new MessageChannel()
    const stream = new WritableStream({})
    channel.port1.postMessage(stream, [stream])
    SUPPORTS_TRANSFERABLE_STREAM = true
  } catch {}
}

export const SUPPORTS_WRITABLE_FILE_STREAM =
  typeof FileSystemFileHandle === 'function' &&
  typeof FileSystemFileHandle.prototype.createWritable === 'function'

export const SUPPORTS_STORAGE = typeof navigator !== 'undefined' && typeof navigator.storage !== 'undefined'

export const KeyParts = {
  Complete: 'complete',
  Size: 'size',
  CurrentSize: 'current-size',
} as const
