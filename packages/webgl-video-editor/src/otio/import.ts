import { uid } from 'uid'
import { unzip } from 'unzipit'

import { getMediaAssetInfo } from '#assets'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'
import type { Otio } from '#otio'

import { FileSystemStorage } from '../storage/file-system-storage.ts'

const plainRational = ({ value, rate }: { value: number; rate: number }) => ({ value, rate })

const OTIO_BUNDLE_INDEX_FILENAME = 'content.otio'

export const documentJSONFromOTIOZ = async (blob: Blob) => {
  const importer = new OtioImporter()
  await importer.readZipFile(blob)
  return importer.result!
}

export const documentJSONFromOTIO = async (
  otio: Otio.TimelineDocument,
  options: RequestInit = {},
): Promise<Schema.SerializedDocument> => {
  const importer = new OtioImporter()
  importer.readTimeline(otio)
  await importer.resolveExternalAssetReferences(options).catch(() => undefined)
  return importer.result!
}

interface WithMediaRef {
  mediaRef?: { assetId?: string | undefined }
}

class OtioImporter {
  otio?: Otio.TimelineDocument
  bundledAssets = new Map<string, { asset: Schema.AnyAssetSchema; blob: Blob }>()
  unresolvedReferences = new Map<string, { asset: Schema.AnyAssetSchema; referers: WithMediaRef[] }>()
  result?: Schema.SerializedDocument
  errors: unknown[] = []

  async readZipFile(file: Blob): Promise<void> {
    const { entries } = await unzip(file)

    if (!(OTIO_BUNDLE_INDEX_FILENAME in entries)) throw new Error('Missing content.otio in bundle')

    const otio = (this.otio = await entries[OTIO_BUNDLE_INDEX_FILENAME].json())

    await Promise.all(
      Object.entries(entries).map(async ([name, entry]) => {
        if (!Object.hasOwn(entries, name) || name === OTIO_BUNDLE_INDEX_FILENAME) return

        try {
          const blob = await entry.blob()
          const asset = await getMediaAssetInfo(name, blob)
          this.bundledAssets.set(name, { asset, blob })
        } catch (error) {
          this.errors.push(error)
        }
      }),
    )

    this.readTimeline(otio)

    using storage = new FileSystemStorage()

    await Promise.all(
      Array.from(this.bundledAssets.values()).map(async ({ asset, blob }) => {
        this.result!.assets.push(asset)
        await storage.create(asset.id, blob)
      }),
    )

    this.resolveExternalAssetReferences({}).catch((error: unknown) => this.errors.push(error))
  }

  readTimeline(otio: Otio.TimelineDocument): void {
    this.otio = otio

    const { Miru: docMetadata, ...metadata } = otio.metadata ?? {}

    const settings: Schema.DocumentSettings = {
      resolution: docMetadata?.resolution ?? DEFAULT_RESOLUTION,
      frameRate: docMetadata?.frameRate ?? DEFAULT_FRAMERATE,
    }

    this.result = {
      metadata,
      ...settings,
      assets: [],
      timeline: this.timelineStack(otio.tracks),
    }
  }

  async resolveExternalAssetReferences(options: RequestInit): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.unresolvedReferences).map(async ([url, { asset, referers }]) => {
        const info = await getMediaAssetInfo(asset.id, url, options)
        this.result!.assets.push(info)
        referers.forEach((clip) => void (clip.mediaRef = { assetId: info.id }))
      }),
    )

    this.errors.push(
      ...results.filter((result) => result.status === 'rejected').map((result) => result.reason),
    )
  }

  timelineStack(item: Otio.TimelineStack): Schema.SerializedTimeline {
    return {
      ...baseNode(item, 'timeline'),
      id: 'timeline',
      children: item.children.map(this.track.bind(this)),
    }
  }

  track(item: Otio.Track): Schema.SerializedTrack {
    const trackType = item.kind === 'Audio' ? 'audio' : 'video'

    const children: Schema.AnySerializedClip[] = []
    let nextChildGapDuration: Schema.Rational | undefined

    item.children.forEach((child) => {
      const otioType = child.OTIO_SCHEMA
      if (otioType === 'Gap.1') {
        nextChildGapDuration = plainRational(child.source_range.duration)
        return
      }

      // TODO
      if (otioType === 'Transition.1') return

      const childInit =
        trackType === 'audio'
          ? this.audioClip(child)
          : child.metadata.Miru?.type === 'clip:text'
            ? textClip(child)
            : this.videoClip(child)

      if (nextChildGapDuration) {
        childInit.gap = nextChildGapDuration
        nextChildGapDuration = undefined
      }

      children.push(childInit)
    })
    return {
      ...baseNode(item, 'track'),
      trackType,
      children,
    }
  }

  clip<T extends Otio.Clip, TT extends Schema.AnyClip['type']>(item: T, type: TT) {
    const mediaReference =
      (item.active_media_reference_key
        ? item.media_references?.[item.active_media_reference_key ?? 'DEFAULT_MEDIA']
        : undefined) ?? item.media_reference
    const url = mediaReference?.target_url ?? ''

    const clip = {
      ...trackChild(item, type),
      sourceStart: plainRational(item.source_range.start_time),
      mediaRef: url ? { assetId: url } : undefined,
    }

    if (this.bundledAssets.has(url)) return clip

    if (url) {
      let missingAssetEntry = this.unresolvedReferences.get(url)
      if (!missingAssetEntry) {
        this.unresolvedReferences.set(
          url,
          (missingAssetEntry = {
            asset: {
              id: uid(),
              type: 'asset:media:av' as const,
              mimeType: `${type === 'clip:audio' ? 'audio' : 'video'}/${mediaReference?.name?.split('.').pop() ?? 'UNKNOWN'}`,
              size: 0,
              duration: 0,
            },
            referers: [],
          }),
        )
      }

      missingAssetEntry.referers.push(clip)
    }

    return clip
  }

  audioClip = (item: Otio.Clip): Schema.SerializedAudioClip => {
    const json: Schema.AudioClip = this.clip(item, 'clip:audio')
    const effects: Schema.AudioClip['effects'] = []

    item.effects.forEach((effect) => {
      if (effect.effect_name === 'AudioGain') json.volume = (effect as unknown as { gain: number }).gain
      else effects.push(effect as any)
    })

    return {
      ...json,
      effects,
    }
  }

  videoClip(item: Otio.Clip): Schema.SerializedVideoClip {
    const json: Schema.VideoClip = this.clip(item, 'clip:video')
    applyTransformEffect(json, item)
    return json
  }

  dispose() {
    this.unresolvedReferences.clear()
  }
}

const baseNode = <TO extends Otio.BaseItem, TT extends pub.AnyNode['type']>(item: TO, type: TT) => {
  const {
    metadata: { Miru, ...metadata },
  } = item

  return {
    id: Miru?.id ?? uid(),
    type,
    name: item.name,
    enabled: item.enabled,
    color: item.color ?? undefined,
    effects: item.effects.map((effect): any => effect.metadata.Miru ?? effect),
    metadata,
  }
}

const trackChild = <TO extends Otio.Clip, TT extends Schema.AnyClip['type']>(item: TO, type: TT) => ({
  ...baseNode(item, type),
  duration: plainRational(item.source_range.duration),
})

const textClip = (item: Otio.Clip): Schema.SerializedTextClip => {
  const metadata = item.metadata.Miru as unknown as Schema.TextClip
  const json: Schema.TextClip = {
    content: metadata.content,
    fontFamily: metadata.fontFamily,
    fontSize: metadata.fontSize,
    fontWeight: metadata.fontWeight,
    inlineSize: metadata.inlineSize,
    fill: metadata.fill,
    stroke: metadata.stroke,
    ...trackChild(item, 'clip:text'),
    sourceStart: plainRational(item.source_range.start_time),
    mediaRef: undefined,
  }
  applyTransformEffect(json, item)
  return json
}

const applyTransformEffect = (json: Partial<Schema.TransformProps>, item: Otio.Clip): void => {
  const transform = item.effects.find((e: any) => e.effect_name === 'SpatialTransformEffect')
  if (!transform) return

  json.translateX = transform.translate.x
  json.translateY = transform.translate.y
  json.rotate = transform.rotate
  json.scaleX = transform.scale.x
  json.scaleY = transform.scale.y
}
