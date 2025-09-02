import { ref } from 'fine-jsx'
import { Effect } from 'webgl-effects'

import { getContainerMetadata, getMediaElementInfo } from 'shared/video/utils'

import type { RootNode } from '../../types/internal'
import { NodeCreateEvent } from '../events.ts'
import { storage } from '../storage/index.ts'

import { BaseNode } from './base-node.ts'
import type { Schema } from './index.ts'
import type { Movie } from './movie.ts'

export abstract class BaseAsset<T extends Schema.Asset> extends BaseNode<T> {
  id: string
  type: T['type']
  raw: T
  abstract isLoading: boolean

  constructor(init: T, root: RootNode) {
    super(init.id, root)
    this.id = init.id
    this.type = init.type
    this.raw = init
  }

  toObject(): T {
    return this.raw
  }
}

export class MediaAsset extends BaseAsset<Schema.AvMediaAsset> {
  declare children?: never
  declare parent?: never

  duration: number
  mimeType: string
  audio?: { duration: number }
  video?: { duration: number; rotation: number }

  blob: Blob
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

  protected constructor(init: Schema.AvMediaAsset, options: { blob: Blob; root: Movie }) {
    const { root } = options
    super(init, root)

    this.#setBlob(options.blob)
    this.blob = options.blob
    const { mimeType, duration, audio, video } = init

    this.mimeType = mimeType
    this.duration = duration
    this.audio = audio
    this.video = video

    root._emit(new NodeCreateEvent(this.id))

    this.onDispose(() => {
      URL.revokeObjectURL(this.objectUrl)
      storage.delete(this.id).catch(() => undefined)
    })
  }

  #setBlob(blob: Blob) {
    URL.revokeObjectURL(this.objectUrl)
    this.blob = blob
    this.#objectUrl.value = URL.createObjectURL(blob)
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
      this.#setBlob(blob)
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
    requestInit?: RequestInit,
  ) {
    const { id } = init

    const asset = new MediaAsset(init, { blob: new Blob(), root })

    ;(async () => {
      const storageHasFile = await storage.hasCompleteFile(id)

      // WIP: add abort signal to all fetches and pipes, etc
      if (!storageHasFile) {
        if (source == null) throw new Error('[webgl-video-editor] Missing media source')

        let stream
        let size: number | undefined

        if (typeof source === 'string') {
          const res = await fetch(source, requestInit)
          const { body } = res
          if (!res.ok || !body) throw new Error('Fetch failed')
          const contentLength = res.headers.get('content-length')

          if (contentLength) {
            const parsed = parseInt(contentLength, 10)
            size = isNaN(parsed) ? undefined : parsed
          }

          stream = body
        } else {
          stream = source.stream()
          ;({ size } = source)
        }

        await storage.fromStream(id, stream, { size, signal: requestInit?.signal })
      }

      asset.#setBlob(await storage.getFile(id))
    })().catch((error: unknown) => {
      asset.#error.value = error
    })

    return asset
  }

  static async clearCache(): Promise<void> {
    await storage.deleteAll()
  }
}

export class VideoEffectAsset extends BaseAsset<Schema.VideoEffectAsset> {
  type = 'asset:effect:video' as const
  declare children?: never
  declare parent?: never

  readonly #effect: Effect
  readonly #isLoading = ref(false)
  shaders: string[] = []

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
    super(init, root)
    const effect = (this.#effect = new Effect(
      init,
      root.renderer,
      (e) => (this.#isLoading.value = e.isLoading),
    ))

    this.onDispose(effect.dispose.bind(effect))
    root._emit(new NodeCreateEvent(this.id))
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
