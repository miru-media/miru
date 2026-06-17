import type * as pub from '#core'
import type { Schema } from '#core'
import type { Otio } from '#otio'
import { Rational } from 'shared/utils'

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
        assets: Array.from(doc.assets.values())
          .filter((asset) => !asset.isBuiltIn)
          .map((asset) => asset.toJSON()),
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

const timelineStack = (node: pub.Timeline): Otio.TimelineStack => ({
  ...baseNode(node, 'Stack.1'),
  name: 'tracks',
  children: node.children.map(track),
})

const track = (node: pub.Track): Otio.Track => {
  const { frameRate } = node.doc

  const children: (Otio.Clip | Otio.Gap)[] = []
  node.children.forEach((child) => {
    if (child.gap.value !== 0) children.push(gap(child.gap))

    children.push(
      child.isTextClip() ? textClip(child) : child.isVideo() ? videoClip(child) : audioClip(child),
    )
  })

  return {
    ...baseNode(node, 'Track.1'),
    source_range: {
      OTIO_SCHEMA: 'TimeRange.1',
      duration: node.duration.toRate(frameRate).toOTIO(),
      start_time: new Rational(0, frameRate).toOTIO(),
    },
    kind: node.isAudio() ? 'Audio' : 'Video',
    children,
  }
}
const trackChild = <T extends pub.AnyTrackChild, TO extends 'Clip.1' | 'Gap.1'>(
  node: T,
  schemaName: TO,
): Otio.TrackChild<TO> => {
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

const mediaClip = <T extends pub.AnyClip>(node: T): Otio.Clip => {
  const { asset } = node

  return {
    ...trackChild(node, 'Clip.1'),
    media_references: {
      DEFAULT_MEDIA: {
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
    },
    active_media_reference_key: 'DEFAULT_MEDIA',
  }
}

const audioClip = (node: pub.AudioClip): Otio.Clip => {
  const otio = mediaClip(node)

  ;(otio.effects ??= []).unshift({
    OTIO_SCHEMA: 'Effect.1',
    name: 'AudioGain',
    effect_name: 'AudioGain',
    gain: node.volume,
    metadata: { Miru: { id: 'volume' } },
  })

  return otio
}

const videoClip = (node: pub.VideoClip): Otio.Clip => {
  const otio = mediaClip(node)
  addTransformEffect(otio, node)
  return otio
}

const textClip = (node: pub.TextClip): Otio.Clip => {
  const otio = {
    ...trackChild(node, 'Clip.1'),
    media_reference: null,
  }
  addTransformEffect(otio, node)
  return otio
}

const gap = (duration: Rational): Otio.Gap => ({
  OTIO_SCHEMA: 'Gap.1',
  source_range: {
    OTIO_SCHEMA: 'TimeRange.1',
    duration: duration.toOTIO(),
    start_time: Rational.ZERO.toOTIO(),
  },
})

const addTransformEffect = (otio: Otio.BaseItem, node: Schema.TransformProps): void => {
  const json = (otio.metadata?.Miru ?? {}) as Partial<Schema.VideoClip>

  if (
    !!(json.translateX ?? 0) ||
    !!(json.translateY ?? 0) ||
    !!(json.rotate ?? 0) ||
    (json.scaleX ?? 1) !== 1 ||
    (json.scaleY ?? 1) !== 1
  ) {
    // https://github.com/AcademySoftwareFoundation/OpenTimelineIO/discussions/1794
    ;(otio.effects ??= []).unshift({
      OTIO_SCHEMA: 'Effect.1',
      name: 'transform',
      effect_name: 'SpatialTransformEffect',
      metadata: {},
      center: { OTIO_SCHEMA: 'V2d.1', x: 0.5, y: 0.5 },
      rotate: node.rotate,
      scale: { OTIO_SCHEMA: 'V2d.1', x: node.scaleX, y: node.scaleY },
      skew: { OTIO_SCHEMA: 'V2d.1', x: 0.0, y: 0.0 },
      translate: { OTIO_SCHEMA: 'V2d.1', x: node.translateX, y: node.translateY },
      filter: 'cubic',
    })
  }
}
