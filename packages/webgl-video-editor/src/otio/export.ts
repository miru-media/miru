import type * as pub from '#core'
import type { Schema } from '#core'
import { Rational } from 'shared/utils'

export namespace Otio {
  export interface TimelineDocument {
    OTIO_SCHEMA: 'Timeline.1'
    metadata?: {
      [index: string]: unknown
      Miru: Schema.DocumentSettings & { assets: Schema.AnyAssetSchema[] }
    }
    name: ''
    global_start_time: null
    tracks: TimelineStack
  }

  export interface BaseItem<T extends string = string> {
    OTIO_SCHEMA: T
    name: string
    enabled: boolean
    color: string | null
    metadata: {
      [index: string]: unknown
      Miru?: { [index: string]: unknown; id: string; type: string }
    }
    effects: {
      [index: string]: any
      OTIO_SCHEMA: 'Effect.1'
      name: string
      effect_name: string
      metadata: { [index: string]: unknown; Miru?: Record<string, any> }
    }[]
  }
  export type TimelineStack = ReturnType<typeof timelineStack>
  export type Track = ReturnType<typeof track>
  export type Clip = ReturnType<typeof mediaClip>
  export type Gap = ReturnType<typeof gap>
}

export const documentToOTIO = (doc: pub.Document): Otio.TimelineDocument => {
  const settings: Schema.DocumentSettings = {
    resolution: doc.resolution,
    frameRate: doc.frameRate,
  }

  return {
    OTIO_SCHEMA: 'Timeline.1',
    metadata: {
      ...settings.metadata,
      Miru: {
        ...settings,
        assets: Array.from(doc.assets.values()).map((asset) => asset.toJSON()),
      },
    },
    name: '',
    global_start_time: null,
    tracks: timelineStack(doc.timeline),
  }
}

const baseNode = <T extends pub.AnyNode, TO extends string>(node: T, OTIO_SCHEMA: TO): Otio.BaseItem<TO> => ({
  OTIO_SCHEMA,
  name: node.name ?? '',
  enabled: node.enabled,
  color: node.color ?? null,
  effects: node.effects.map((effect): any => ({
    OTIO_SCHEMA: 'Effect.1',
    name: effect.assetId,
    effect_name: effect.assetId,
    metadata: { Miru: effect },
  })),
  metadata: { ...node.metadata, Miru: { id: node.id, type: node.type } },
})

const timelineStack = (node: pub.Timeline) => ({
  ...baseNode(node, 'Stack.1'),
  name: 'tracks',
  children: node.children.map(track),
})

const track = (node: pub.Track) => {
  const { frameRate } = node.doc

  return {
    ...baseNode(node, 'Track.1'),
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      duration: node.duration.toRate(frameRate).toOTIO(),
      start_time: new Rational(0, frameRate).toOTIO(),
    },
    kind: node.isAudio() ? 'Audio' : 'Video',
    children: node.children.map((child) => {
      if (child.isMediaClip()) return child.isVideo() ? videoClip(child) : audioClip(child)
      if (child.isTextClip()) return textClip(child)
      return gap(child)
    }),
  }
}
const trackChild = <T extends pub.AnyTrackChild, TO extends string>(node: T, schemaName: TO) => {
  const { duration, source } = node.timeRational

  return {
    ...baseNode(node, schemaName),
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      duration: duration.toOTIO(),
      start_time: source.toOTIO(),
    },
  }
}

const mediaClip = <T extends pub.AnyClip>(node: T) => {
  const { asset } = node

  return {
    ...trackChild(node, 'Clip.1'),
    media_reference: {
      OTIO_SCHEMA: 'ExternalReference.1',
      metadata: {
        Miru: node.mediaRef,
      },
      name: asset?.name ?? '',
      available_range: asset
        ? {
            OTIO_SCHEMA: 'TimeRange.1',
            duration: Rational.simplified(asset.duration, 1).toOTIO(),
            start_time: Rational.ZERO.toOTIO(),
          }
        : null,
      target_url: (asset?.uri ?? asset?.name ?? '') || null,
    },
  }
}

const audioClip = (node: pub.AudioClip) => {
  const otio = mediaClip(node)

  otio.effects.unshift({
    OTIO_SCHEMA: 'Effect.1',
    name: 'AudioGain',
    effect_name: 'AudioGain',
    gain: node.volume,
    metadata: { Miru: { id: 'volume' } },
  })

  return otio
}

const videoClip = (node: pub.VideoClip) => {
  const otio = mediaClip(node)
  addTransformEffect(otio, node)
  return otio
}

const textClip = (node: pub.TextClip) => {
  const otio = {
    ...trackChild(node, 'Clip.1'),
    media_reference: {
      OTIO_SCHEMA: 'ExternalReference.1',
      metadata: {
        Miru: {
          fontFamily: node.fontFamily,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          fill: node.fill,
          stroke: node.stroke,
        },
      },
      name: '',
      available_range: null,
      target_url: null,
    },
  }
  addTransformEffect(otio, node)
  return otio
}

const gap = (node: pub.Gap) => trackChild(node, 'Gap.1')

const addTransformEffect = (otio: Otio.BaseItem, node: Schema.TransformProps): void => {
  const json = otio.metadata.Miru as Partial<Schema.VideoClip>

  if (!!json.translate || !!(json.rotate ?? 0) || !!json.scale) {
    // https://github.com/AcademySoftwareFoundation/OpenTimelineIO/discussions/1794
    otio.effects.unshift({
      OTIO_SCHEMA: 'Effect.1',
      name: 'transform',
      effect_name: 'SpatialTransformEffect',
      metadata: {},
      center: { OTIO_SCHEMA: 'V2d.1', x: 0.5, y: 0.5 },
      rotate: node.rotate,
      scale: { OTIO_SCHEMA: 'V2d.1', ...node.scale },
      skew: { OTIO_SCHEMA: 'V2d.1', x: 0.0, y: 0.0 },
      translate: { OTIO_SCHEMA: 'V2d.1', ...node.translate },
      filter: 'cubic',
    })
  }
}
