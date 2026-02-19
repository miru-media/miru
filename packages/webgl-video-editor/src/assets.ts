import { ref } from 'fine-jsx'
import type { EffectOp } from 'webgl-effects'

import { Janitor } from 'shared/utils/general.ts'
import { getContainerMetadata, getMediaElementInfo } from 'shared/video/utils'

import type * as pub from '../types/core'
import type { Schema } from '../types/core'
import type { RootNode } from '../types/internal'

import { AssetCreateEvent, AssetDeleteEvent, AssetRefreshEvent } from './events.ts'
import type { BaseMovie } from './nodes/base-movie.ts'
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
  audio?: { duration: number }
  video?: { duration: number; rotation: number; width: number; height: number }

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

  get isLoading() {
    return this.#isLoading.value
  }

  get error() {
    return this.#error.value
  }

  constructor(init: Schema.AvMediaAsset, options: { source?: Blob | string; root: BaseMovie }) {
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

    let stream: ReadableStream<Uint8Array>

    if (isBlobSource) {
      stream = source.stream()
      mimeType ||= source.type
    } else {
      try {
        const res = await fetch(source, requestInit)
        const { body } = res
        if (!res.ok || !body) throw new Error('Fetch failed')

        stream = body
        mimeType ||= res.headers.get('content-type') ?? ''
      } catch (error) {
        throw new Error(`[webgl-video-editor] Failed to fetch asset from "${source}".`, { cause: error })
      }
    }

    const containerOrElementInfo = await getContainerMetadata(stream, requestInit).catch(() =>
      getMediaElementInfo(source, requestInit),
    )
    let { duration } = containerOrElementInfo

    let hasAudio = false
    let audio
    let video

    if ('hasAudio' in containerOrElementInfo) {
      ;({ hasAudio } = containerOrElementInfo)
      const { width, height } = containerOrElementInfo

      audio = hasAudio ? { duration } : undefined
      // we can't know whether or not there's a video track
      video = { duration, rotation: 0, width, height }
    } else {
      const { audio: audio_, video: video_ } = containerOrElementInfo
      audio = audio_ && {
        duration: audio_.duration,
      }
      video = video_ && {
        duration: video_.duration,
        rotation: video_.rotation,
        width: video_.codedWidth,
        height: video_.codedHeight,
      }
      hasAudio = !!containerOrElementInfo.audio

      duration = Math.min(duration, audio?.duration ?? Infinity, video?.duration ?? Infinity)
    }

    return {
      id,
      type: 'asset:media:av',
      mimeType,
      name,
      duration,
      audio,
      video,
    }
  }

  static fromInit(
    init: Schema.AvMediaAsset,
    root: BaseMovie,
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
  declare children?: never
  declare parent?: never

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
