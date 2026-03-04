import { uid } from 'uid'

import type * as pub from '../../types/core.d.ts'
import type { Schema } from '../../types/core.d.ts'
import { AssetCreateEvent } from '../events.ts'
import { FileSystemStorage } from '../storage/file-system-storage.ts'

import { MediaAsset } from './media-asset.ts'
import { getMediaAssetInfo } from './utils.ts'
import { VideoEffectAsset } from './video-effect-asset.ts'

export class FileSystemAssetStore extends EventTarget implements pub.VideoEditorAssetStore {
  readonly #map = new Map<string, pub.AnyAsset>()
  readonly #abort = new AbortController()
  isDisposed = false
  fileStorage = new FileSystemStorage()
  loaders: pub.AssetLoader[] = []
  protected generateId: () => string
  protected getMediaAssetInfo = getMediaAssetInfo

  constructor(generateId: () => string = uid) {
    super()
    this.generateId = generateId
  }

  values(): MapIterator<pub.AnyAsset> {
    return this.#map.values()
  }

  has(id: string): boolean {
    return this.#map.has(id)
  }

  create<T extends Schema.AnyAssetSchema>(
    init: T,
    { source }: { source?: Blob | string } = {},
  ): pub.AssetsByType[T['type']] {
    let asset

    switch (init.type) {
      case 'asset:media:av':
        asset = new MediaAsset(init, { store: this, source })
        this.getOrCreateFile(asset, source ?? ('uri' in init ? init.uri : undefined))
          .then(asset.setBlob.bind(asset))
          .catch(asset.setError.bind(asset))
        break

      case 'asset:effect:video':
        asset = new VideoEffectAsset(init, this)
        break
    }

    this.#map.set(asset.id, asset)
    this.#emit(new AssetCreateEvent(asset))

    return asset as unknown as pub.AssetsByType[T['type']]
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
  getAsset<T extends pub.AnyAsset | undefined>(id: string): T {
    return this.#map.get(id) as T
  }

  async createFile(
    asset: pub.MediaAsset,
    stream: ReadableStream<Uint8Array>,
    options: { onProgress?: (progress: number) => void; signal?: AbortSignal | null },
  ): Promise<void> {
    await this.fileStorage.create(asset.id, stream, { ...options, size: asset.size })
  }

  async getFile(key: string, name?: string, options?: FilePropertyBag): Promise<File> {
    return await this.fileStorage.get(key, name, options)
  }

  async getOrCreateFile(
    asset: pub.MediaAsset,
    source: Blob | string | undefined,
    options?: { signal?: AbortSignal | null },
  ): Promise<File> {
    const storageHasFile = await this.fileStorage.hasCompleteFile(asset.id)

    if (!storageHasFile) {
      if (source == null) throw new Error('[webgl-video-editor] Missing file blob or uri.')

      const loader = this.loaders.find((l) => l.canLoad(asset))

      if (!loader) throw new Error('[webgl-video-editor] Unable to load asset.')

      const { stream, size } = await loader.load(asset, options)

      await this.fileStorage.create(asset.id, stream, { ...options, size })
    }

    return await this.fileStorage.get(asset.id)
  }

  async delete(key: string): Promise<void> {
    await this.fileStorage.delete(key)
    this.getAsset(key)?.dispose()
    this.#map.delete(key)
  }

  async createMediaAsset(source: Blob | string): Promise<pub.MediaAsset> {
    const init = await getMediaAssetInfo(this.generateId(), source)
    return this.create(init, { source })
  }

  #emit(event: pub.VideoEditorEvents[pub.AssetEventType]): void {
    this.dispatchEvent(event)
  }

  on<T extends pub.AssetEventType>(
    type: T,
    listener: (event: pub.VideoEditorEvents[T]) => void,
    options?: AddEventListenerOptions,
  ) {
    options = { signal: this.#abort.signal, ...options }
    this.addEventListener(type, listener as EventListener, options)
    return () => this.removeEventListener(type, listener as EventListener, options)
  }

  dispose(): void {
    this.isDisposed = true
    this.fileStorage.dispose()
    this.#abort.abort()

    this.#map.forEach((s) => s.dispose())
    this.#map.clear()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
