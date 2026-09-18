import { ref } from 'fine-jsx'

import type * as pub from '#core'
import type * as Schema from '#schema'

import { BaseAsset } from './base-asset.ts'

export class BaseFileAsset<T extends Schema.MediaAsset | Schema.ImageAsset>
  extends BaseAsset<T>
  implements pub.BaseFileAsset
{
  name?: string
  readonly mimeType: string
  readonly color: Schema.MediaAsset['color']
  readonly metadata: Schema.MediaAsset['metadata']

  blob?: Blob
  readonly #blobUrl = ref('')
  #isRefreshing = false
  readonly #isLoading = ref(true)
  readonly #error = ref<unknown>()

  get blobUrl() {
    return this.#blobUrl.value
  }

  get size() {
    return this.raw.size
  }

  get isLoading() {
    return this.#isLoading.value
  }

  get error() {
    return this.#error.value
  }

  readonly #uri = ref<string>()
  get uri(): string | undefined {
    return this.#uri.value
  }
  set uri(value) {
    this.#uri.value = value
    if (!this.isLoading && !this.blob) void this._refreshObjectUrl()
  }

  constructor(
    init: T,
    options: { source?: Blob | string; store: pub.VideoEditorAssetStore; isBuiltIn?: boolean },
  ) {
    const { store, source, isBuiltIn } = options
    super(init, store, isBuiltIn)

    this.setBlob(source == null || typeof source === 'string' ? undefined : source)

    this.name = init.name
    this.mimeType = init.mimeType
    this.uri = init.uri
    this.color = init.color
    this.metadata = init.metadata
  }

  setBlob(blob: Blob | undefined): void {
    URL.revokeObjectURL(this.blobUrl)

    if (blob) {
      this.blob = blob
      this.#blobUrl.value = URL.createObjectURL(blob)
      this.#isRefreshing = this.#isLoading.value = false
    } else {
      this.blob = undefined
      this.#isLoading.value = true
    }
  }

  setError(error: unknown) {
    this.#error.value = error
  }

  async _refreshObjectUrl() {
    if (this.#isRefreshing) return
    this.#isRefreshing = this.#isLoading.value = true

    try {
      const res = await fetch(this.blobUrl)
      res.body?.cancel().catch(() => undefined)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      this.#isRefreshing = this.#isLoading.value = false
    } catch (error) {
      // eslint-disable-next-line no-console -- dev error message
      if (import.meta.env.DEV) console.error(error)
      this.setBlob(await this.store.getOrCreateFile(this, undefined))
    }
  }

  dispose(): void {
    super.dispose()
    URL.revokeObjectURL(this.blobUrl)
    this.blob = undefined
  }
}

export class MediaAsset extends BaseFileAsset<Schema.MediaAsset> implements pub.MediaAsset {
  readonly duration: number
  readonly audio: Schema.MediaAsset['audio']
  readonly video: Schema.MediaAsset['video']

  constructor(
    init: Schema.MediaAsset,
    options: { source?: Blob | string; store: pub.VideoEditorAssetStore; isBuiltIn?: boolean },
  ) {
    super(init, options)
    this.duration = init.duration
    this.audio = init.audio
    this.video = init.video
  }
}

export class ImageAsset extends BaseFileAsset<Schema.ImageAsset> implements pub.ImageAsset {
  readonly width: Schema.ImageAsset['width']
  readonly height: Schema.ImageAsset['height']
  readonly rotation: Schema.ImageAsset['rotation']

  constructor(
    init: Schema.ImageAsset,
    options: { source?: Blob | string; store: pub.VideoEditorAssetStore; isBuiltIn?: boolean },
  ) {
    super(init, options)
    this.width = init.width
    this.height = init.height
    this.rotation = init.rotation
  }
}
