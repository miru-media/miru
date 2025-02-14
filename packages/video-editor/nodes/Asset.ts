import { Effect } from 'reactive-effects/Effect'

import { getContainerInfo, getMediaElementInfo } from '../utils'

import { type Schema } from '.'

abstract class Asset<T extends Schema.Asset> {
  id: string
  type: T['type']
  raw: T

  constructor(init: T) {
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

  if (!askedToPersist && !(await navigator.storage.persisted().catch(() => false))) {
    askedToPersist = true
    navigator.storage.persist().catch(() => undefined)
  }
}

export class MediaAsset extends Asset<Schema.AvMediaAsset> {
  objectUrl: string
  url?: string
  duration: number
  audio?: { duration: number }
  video?: { duration: number; rotation: number }

  protected constructor(init: Schema.AvMediaAsset, options: { blob: Blob }) {
    super(init)

    this.url = init.url
    this.objectUrl = URL.createObjectURL(options.blob)
    const { duration, audio, video } = init
    this.duration = duration
    this.audio = audio
    this.video = video
  }

  dispose() {
    URL.revokeObjectURL(this.objectUrl)
    openCache()
      .then((cache) => cache.delete(getCacheKey(this.id)))
      .catch(() => undefined)
  }

  static async fromInit(init: Schema.AvMediaAsset) {
    const blob = await getCachedBlob(init.id)

    if (!blob && init.url) return this.fromSource(init.id, init.url)

    if (!blob) throw new Error('[video-editor] Asset data was never fetched and cached')

    return new MediaAsset(init, { blob })
  }

  static async fromSource(id: string, urlOrBlob: string | Blob) {
    const isBlobSource = typeof urlOrBlob !== 'string'

    if (!isBlobSource && urlOrBlob.startsWith('blob:')) throw new Error(`[video-editor] Unexpected blob: URL`)

    const blob = isBlobSource ? urlOrBlob : await fetch(urlOrBlob).then((res) => res.blob())
    await addToCache(id, blob)

    const containerOrElementInfo = await getContainerInfo(blob).catch(() => getMediaElementInfo(blob))
    let duration = containerOrElementInfo.duration

    let hasAudio = false
    let audio
    let video

    if ('hasAudio' in containerOrElementInfo) {
      hasAudio = containerOrElementInfo.hasAudio
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
        duration,
        audio,
        video,
      },
      { blob },
    )
  }

  static clearCache() {
    return caches.delete(CACHE_NAME)
  }
}

export class VideoEffectAsset extends Effect {
  toObject(): Schema.VideoEffectAsse {
    return {
      ...super.toObject(),
      id: this.id,
      type: 'video_effect_asset',
    }
  }
}
