import { ref } from 'fine-jsx'
import { Effect } from 'webgl-effects'

import { Janitor } from 'shared/utils/general.ts'
import { getContainerMetadata, getMediaElementInfo } from 'shared/video/utils'

import type { RootNode } from '../../types/internal'
import { AssetCreateEvent } from '../events.ts'
import { storage } from '../storage/index.ts'

import type { Schema } from './index.ts'
import type { Movie } from './movie.ts'

export abstract class BaseAsset<T extends Schema.Asset> {
  id: string
  type: T['type']
  raw: T
  abstract isLoading: boolean
  readonly #janitor = new Janitor()

  constructor(init: T) {
    this.id = init.id
    this.type = init.type
    this.raw = init
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

export class MediaAsset extends BaseAsset<Schema.AvMediaAsset> {
  declare children?: never
  declare parent?: never

  duration: number
  mimeType: string
  audio?: { duration: number }
  video?: { duration: number; rotation: number }

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

  constructor(init: Schema.AvMediaAsset, options: { source?: Blob | string; root: Movie }) {
    const { root, source } = options
    super(init)

    const blob = source == null || typeof source === 'string' ? new Blob() : source

    this.setBlob(blob)
    const { mimeType, duration, audio, video } = init

    this.mimeType = mimeType
    this.duration = duration
    this.audio = audio
    this.video = video

    this.onDispose(() => {
      URL.revokeObjectURL(this.objectUrl)
      storage.delete(this.id).catch(() => undefined)
    })

    root.assets.set(this.id, this)
    root._emit(new AssetCreateEvent(this.id, source))
  }

  setBlob(blob: Blob) {
    URL.revokeObjectURL(this.objectUrl)
    this.blob = blob
    this.#objectUrl.value = URL.createObjectURL(blob)
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
    } catch (error) {
      // eslint-disable-next-line no-console -- dev error message
      if (import.meta.env.DEV) console.error(error)

      if (!(await storage.hasCompleteFile(this.id)))
        throw new Error(`[webgl-video-editor] couldn't get asset data from storage (${this.id})`)

      const blob = await storage.getFile(this.id)
      this.setBlob(blob)
    } finally {
      this.#isRefreshing = this.#isLoading.value = false
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
      audio = hasAudio ? { duration } : undefined
      // we can't know whether or not there's a video track
      video = { duration, rotation: 0 }
    } else {
      const { audio: audio_, video: video_ } = containerOrElementInfo
      audio = audio_ && {
        duration: audio_.duration,
      }
      video = video_ && {
        duration: video_.duration,
        rotation: video_.rotation,
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
    root: Movie,
    source: string | (Blob & { name?: string }) | undefined = init.url,
  ): MediaAsset {
    const asset = new MediaAsset(init, { source, root })

    return asset
  }

  static async clearCache(): Promise<void> {
    await storage.deleteAll()
  }
}

export class VideoEffectAsset {
  readonly id: string
  readonly type = 'asset:effect:video' as const
  declare children?: never
  declare parent?: never

  readonly #effect: Effect
  readonly #isLoading = ref(false)
  shaders: string[] = []

  readonly #janitor = new Janitor()

  get name() {
    return this.#effect.name
  }
  get ops() {
    return this.#effect.ops
  }
  get promise(): Promise<undefined[]> | undefined {
    return this.#effect.promise
  }
  get isLoading() {
    return this.#isLoading.value
  }

  constructor(init: Schema.VideoEffectAsset, root: RootNode) {
    this.id = init.id
    this.#effect = new Effect(init, root.renderer, (e) => (this.#isLoading.value = e.isLoading))
    root.assets.set(this.id, this)
    root._emit(new AssetCreateEvent(this.id))

    this.#janitor.add(this.#effect.dispose.bind(this.#effect))
  }

  dispose() {
    this.#janitor.dispose()
  }

  onDispose(fn: () => void) {
    this.#janitor.add(fn)
  }

  toObject(): Schema.VideoEffectAsset {
    return {
      ...this.#effect.toObject(),
      name: this.name,
      id: this.id,
      type: 'asset:effect:video',
    }
  }
}
