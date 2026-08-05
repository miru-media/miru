import { FileSystemStorage } from '../../../packages/webgl-video-editor/src/storage/file-system-storage.ts'

export const thumbnailStorage = {
  _storage: new FileSystemStorage(),
  _toKey: (id: string) => `${id}_thumbnail`,

  async get(id: string): Promise<Blob | undefined> {
    const key = this._toKey(id)
    return await this._storage.get(key).catch(() => undefined)
  },

  async setImage(id: string, source: Blob | ReadableStream<Uint8Array>): Promise<void> {
    await this._storage.create(this._toKey(id), source)
  },

  async setFromCanvas(id: string, canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void> {
    const blob = await ('convertToBlob' in canvas
      ? canvas.convertToBlob()
      : new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) =>
            result ? resolve(result) : reject(new Error(`Couldn't get canvas blob for thumbnail.`)),
          )
        }))

    await this.setImage(id, blob)
  },
}
