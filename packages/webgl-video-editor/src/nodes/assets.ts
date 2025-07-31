import { ref } from 'fine-jsx'

import { Effect } from 'reactive-effects/effect'
import { getContainerMetadata, getMediaElementInfo } from 'shared/video/utils'

import { storage } from '../storage/index.ts'

import { BaseNode } from './base-node.ts'
import type { Schema } from './index.ts'
import type { Movie } from './movie.ts'

abstract class Asset<T extends Schema.Asset> extends BaseNode {
  id: string
  type: T['type']
  raw: T

  constructor(init: T, root: Movie) {
    super(init.id, root)
    this.id = init.id
    this.type = init.type
    this.raw = init
  }

  toObject(): T {
    return this.raw
  }
}

export class MediaAsset extends Asset<Schema.AvMediaAsset> {
  duration: number
  mimeType: string
  audio?: { duration: number }
  video?: { duration: number; rotation: number }

  blob: Blob
  readonly #objectUrl = ref('')
  #isRefreshing = false

  get objectUrl() {
    return this.#objectUrl.value
  }

  get name() {
    return this.raw.name ?? ''
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

    root.nodes.set(this)
    root.assets.add(this)
  }

  #setBlob(blob: Blob) {
    URL.revokeObjectURL(this.objectUrl)
    this.#objectUrl.value = URL.createObjectURL(blob)
  }

  async _refreshObjectUrl() {
    if (this.#isRefreshing) return
    this.#isRefreshing = true

    try {
      const res = await fetch(this.objectUrl)
      res.body?.cancel().catch(() => undefined)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    } catch (error) {
      // eslint-disable-next-line no-console -- dev error message
      if (import.meta.env.DEV) console.error(error)

      if (!(await storage.hasCompleteFile(this.id)))
        throw new Error(`[video-editor] couldn't get asset data from storage (${this.id})`)

      const blob = await storage.getFile(this.id)
      this.#setBlob(blob)
    } finally {
      this.#isRefreshing = false
    }
  }

  dispose() {
    URL.revokeObjectURL(this.objectUrl)
    storage.delete(this.id).catch(() => undefined)
  }

  static async fromInit(init: Schema.AvMediaAsset, root: Movie) {
    const { id } = init
    const storageHasFile = await storage.hasCompleteFile(id)

    if (!storageHasFile) {
      if (init.url) return await this.fromSource(id, root, init.url, init)

      throw new Error('[video-editor] Asset data was never fetched and cached')
    }

    const blob = await storage.getFile(id)

    return new MediaAsset(init, { blob, root })
  }

  // eslint-disable-next-line @typescript-eslint/max-params -- internal
  static async fromSource(
    id: string,
    root: Movie,
    urlOrBlob: string | (Blob & { name?: string }),
    init?: Schema.AvMediaAsset,
    signal?: AbortSignal,
  ): Promise<MediaAsset> {
    const isBlobSource = typeof urlOrBlob !== 'string'
    let mimeType = init?.mimeType ?? ''
    const name = isBlobSource
      ? 'name' in urlOrBlob
        ? urlOrBlob.name
        : undefined
      : urlOrBlob.replace(/.*\//, '')

    let size: number | undefined
    let stream: ReadableStream<Uint8Array>

    if (isBlobSource) {
      stream = urlOrBlob.stream()
      ;({ size } = urlOrBlob)
      mimeType ||= urlOrBlob.type
    } else {
      try {
        const res = await fetch(urlOrBlob, { signal })
        const { body } = res
        if (!res.ok || !body) throw new Error('Fetch failed')

        stream = body
        mimeType ||= res.headers.get('content-type') ?? ''
      } catch (error) {
        throw new Error(`[video-editor] Failed to fetch asset from "${urlOrBlob}".`, { cause: error })
      }
    }

    await storage.fromStream(id, stream, { size, signal })

    const blob = isBlobSource ? urlOrBlob : await storage.getFile(id, init?.name, { type: mimeType })

    if (init) return new MediaAsset({ ...init, id }, { blob, root })

    const containerOrElementInfo = await getContainerMetadata(blob).catch(() => getMediaElementInfo(blob))
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

    return new MediaAsset(
      {
        id,
        type: 'av_media_asset',
        mimeType,
        name,
        duration,
        audio,
        video,
      },
      { blob, root },
    )
  }

  static async clearCache(): Promise<void> {
    await storage.deleteAll()
  }
}

export class VideoEffectAsset extends Effect {
  type = 'video_effect_asset' as const

  toObject(): Schema.VideoEffectAsset {
    return {
      ...super.toObject(),
      name: this.name,
      id: this.id,
      type: 'video_effect_asset',
    }
  }
}
