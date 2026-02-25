import { ref } from 'fine-jsx'
import * as Mb from 'mediabunny'
import type { EffectOp } from 'webgl-effects'

import { Janitor } from 'shared/utils/general.ts'

import type * as pub from '../types/core'
import type { Schema } from '../types/core'
import type { RootNode } from '../types/internal'

import type { Document } from './document.ts'
import { AssetCreateEvent, AssetDeleteEvent, AssetRefreshEvent } from './events.ts'
import { storage } from './storage/index.ts'

export abstract class BaseAsset<T extends Schema.AnyAsset = any> {
  id: string
  type: T['type']
  root: RootNode
  raw: T
  abstract isLoading: boolean
  readonly #janitor = new Janitor()

  constructor(init: T, root: RootNode) {
    this.id = init.id
    this.type = init.type
    this.root = root
    this.raw = init
    root._emit(new AssetDeleteEvent(this))
  }

  toObject(): T {
    return this.raw
  }

  onDispose(fn: () => void) {
    this.#janitor.add(fn)
  }

  dispose() {
    this.#janitor.dispose()
  }
}

export class MediaAsset extends BaseAsset<Schema.AvMediaAsset> implements pub.MediaAsset {
  duration: number
  mimeType: string
  audio?: Schema.AvMediaAsset['audio']
  video?: Schema.AvMediaAsset['video']

  blob!: Blob
  readonly #objectUrl = ref('')
  #isRefreshing = false
  readonly #isLoading = ref(true)
  readonly #error = ref<unknown>()

  get objectUrl() {
    return this.#objectUrl.value
  }

  get name() {
    return this.raw.name ?? ''
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

  constructor(init: Schema.AvMediaAsset, options: { source?: Blob | string; root: Document }) {
    const { root, source } = options
    super(init, root)

    this.setBlob(source == null || typeof source === 'string' ? null : source)
    const { mimeType, duration, audio, video } = init

    this.mimeType = mimeType
    this.duration = duration
    this.audio = audio
    this.video = video

    this.onDispose(() => {
      URL.revokeObjectURL(this.objectUrl)
      storage.delete(this.id).catch(() => undefined)
    })

    root._emit(new AssetCreateEvent(this, source))
  }

  setBlob(blob: Blob | null) {
    URL.revokeObjectURL(this.objectUrl)

    if (blob) {
      this.blob = blob
      this.#objectUrl.value = URL.createObjectURL(blob)
      this.#isRefreshing = this.#isLoading.value = false
    } else {
      this.blob = new Blob()
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
      const res = await fetch(this.objectUrl)
      res.body?.cancel().catch(() => undefined)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      this.#isRefreshing = this.#isLoading.value = false
    } catch (error) {
      // eslint-disable-next-line no-console -- dev error message
      if (import.meta.env.DEV) console.error(error)
      this.root._emit(new AssetRefreshEvent(this))
    }
  }

  static async getAvMediaAssetInfo(
    id: string,
    source: string | Blob | File,
    requestInit?: RequestInit,
  ): Promise<Schema.AvMediaAsset> {
    const isBlobSource = typeof source !== 'string'
    let mimeType = isBlobSource ? source.type : ''
    const name = isBlobSource ? ('name' in source ? source.name : undefined) : source.replace(/.*\//, '')

    let mbSource: Mb.Source
    let size: number

    if (isBlobSource) {
      mbSource = new Mb.BlobSource(source)
      ;({ size } = source)
    } else {
      try {
        const res = await fetch(source, requestInit)
        const { body } = res
        if (!res.ok || !body) throw new Error('Fetch failed')

        mimeType ||= res.headers.get('content-type') ?? ''

        const contentLength = res.headers.get('content-length')
        if (contentLength) {
          size = parseInt(contentLength, 10)
          mbSource = new Mb.UrlSource(source)
        } else {
          const blob = await res.blob()
          mbSource = new Mb.BlobSource(blob)
          ;({ size } = blob)
        }
      } catch (error) {
        throw new Error(`[webgl-video-editor] Failed to fetch asset from "${source}".`, { cause: error })
      }
    }

    const input = new Mb.Input({
      formats: Mb.ALL_FORMATS,
      source: mbSource,
    })

    const video = await input.getPrimaryVideoTrack()
    const audio = await input.getPrimaryAudioTrack()

    if (video?.codec === null) throw new Error(`[webgl-video-editor] Couldn't get media video codec.`)
    if (audio?.codec === null) throw new Error(`[webgl-audio-editor] Couldn't get media audio codec.`)

    return {
      id,
      type: 'asset:media:av',
      mimeType: await input.getMimeType(),
      name,
      size,
      audio: audio
        ? {
            codec: audio.codec,
            duration: await audio.computeDuration(),
            numberOfChannels: audio.numberOfChannels,
            sampleRate: audio.sampleRate,
            firstTimestamp: await audio.getFirstTimestamp(),
          }
        : undefined,
      video: video
        ? {
            codec: video.codec,
            duration: await video.computeDuration(),
            rotation: video.rotation,
            width: video.codedWidth,
            height: video.codedHeight,
            frameRate: (await video.computePacketStats()).averagePacketRate,
            firstTimestamp: await video.getFirstTimestamp(),
          }
        : undefined,
      duration: await input.computeDuration(),
    }
  }

  static fromInit(
    init: Schema.AvMediaAsset,
    root: Document,
    source: string | (Blob & { name?: string }) | undefined = init.url,
  ): MediaAsset {
    const asset = new MediaAsset(init, { source, root })

    return asset
  }

  static async clearCache(): Promise<void> {
    await storage.deleteAll()
  }
}

export class VideoEffectAsset extends BaseAsset<Schema.VideoEffectAsset> implements pub.VideoEffectAsset {
  readonly id: string
  readonly type = 'asset:effect:video' as const

  readonly #isLoading = ref(false)
  shaders: string[] = []

  readonly #janitor = new Janitor()

  get name(): string {
    return this.raw.name
  }
  get ops(): EffectOp[] {
    return this.raw.ops
  }
  get isLoading(): boolean {
    return this.#isLoading.value
  }

  constructor(init: Schema.VideoEffectAsset, root: RootNode) {
    super(init, root)
    this.id = init.id
    root.assets.set(this.id, this)
    root._emit(new AssetCreateEvent(this))
  }

  dispose(): void {
    this.#janitor.dispose()
  }

  onDispose(fn: () => void): void {
    this.#janitor.add(fn)
  }

  toObject(): Schema.VideoEffectAsset {
    return {
      ...this.raw,
      name: this.name,
      id: this.id,
      type: 'asset:effect:video',
    }
  }
}
