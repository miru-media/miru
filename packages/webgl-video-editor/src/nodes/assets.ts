import { ref } from 'fine-jsx'

import { Effect } from 'reactive-effects/effect'
import { getContainerMetadata, getMediaElementInfo } from 'shared/video/utils'

import type { Schema } from '.'

import { BaseNode } from './base-node'
import type { Movie } from './movie'

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

let askedToPersist = false

const CACHE_NAME = `video-editor:assets`
const openCache = () => caches.open(CACHE_NAME)
const getCacheKey = (assetId: string) => `/${CACHE_NAME}/${assetId}`
const getCachedBlob = (assetId: string) =>
  openCache().then((cache) => cache.match(getCacheKey(assetId)).then((res) => res?.blob()))

const addToCache = async (assetId: string, blob: Blob) => {
  const cache = await openCache()

  await cache.put(getCacheKey(assetId), new Response(blob))

  if (
    !askedToPersist &&
    'storage' in navigator &&
    !(await navigator.storage.persisted().catch(() => false))
  ) {
    askedToPersist = true
    navigator.storage.persist().catch(() => undefined)
  }
}

export class MediaAsset extends Asset<Schema.AvMediaAsset> {
  duration: number
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
    const { duration, audio, video } = init
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

    const url = this.objectUrl
    try {
      const res = await fetch(url)
      res.body?.cancel().catch(() => undefined)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    } catch (error) {
      // eslint-disable-next-line no-console -- dev error message
      if (import.meta.env.DEV) console.error(error)

      const cachedBlob = await getCachedBlob(this.id)
      if (!cachedBlob) throw new Error(`[video-editor] couldn't get asset data from cache (${this.id})`)

      this.#setBlob(cachedBlob)
    } finally {
      this.#isRefreshing = false
    }
  }

  dispose() {
    URL.revokeObjectURL(this.objectUrl)
    openCache()
      .then((cache) => cache.delete(getCacheKey(this.id)))
      .catch(() => undefined)
  }

  static async fromInit(init: Schema.AvMediaAsset, root: Movie) {
    const blob = await getCachedBlob(init.id)

    if (!blob && init.url) return await this.fromSource(init.id, root, init.url, init)

    if (!blob) throw new Error('[video-editor] Asset data was never fetched and cached')

    return new MediaAsset(init, { blob, root })
  }

  static async fromSource(
    id: string,
    root: Movie,
    urlOrBlob: string | (Blob & { name?: string }),
    init?: Schema.AvMediaAsset,
  ) {
    const isBlobSource = typeof urlOrBlob !== 'string'
    const name = isBlobSource
      ? 'name' in urlOrBlob
        ? urlOrBlob.name
        : undefined
      : urlOrBlob.replace(/.*\//, '')

    const blob = isBlobSource ? urlOrBlob : await fetch(urlOrBlob).then((res) => res.blob())
    await addToCache(id, blob)

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
        name,
        duration,
        audio,
        video,
      },
      { blob, root },
    )
  }

  static async clearCache() {
    return await caches.delete(CACHE_NAME)
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
