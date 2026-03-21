import type * as pub from '#core'
import type { Schema } from '#core'
import { Rational } from 'shared/utils'

export const documentToOTIO = (doc: pub.Document) => {
  const serialize = <T extends (Schema.AnyNode | Schema.AnyAssetSchema)['type']>(
    node: Extract<pub.AnyNode | pub.AnyAsset, { type: T }>,
  ): Record<string, any> => {
    if ('children' in node) {
      return {
        ...nodeOrAssetToOTIO(node),
        children: node.children.map(serialize),
      }
    }

    return nodeOrAssetToOTIO(node)
  }

  const settings: Schema.DocumentSettings = {
    resolution: doc.resolution,
    frameRate: doc.frameRate,
  }

  return {
    OTIO_SCHEMA: 'Timeline.1',
    metadata: {
      Miru: {
        ...settings,
        assets: Array.from(doc.assets.values()).map(serialize),
      },
    },
    name: '',
    global_start_time: null,
    tracks: serialize(doc.timeline),
  }
}

const nodeOrAssetToOTIO = <T extends pub.AnyNode | pub.AnyAsset>(item: T) => {
  switch (item.type) {
    case 'timeline':
      return timeline(item)
    case 'track':
      return track(item)
    case 'clip':
      return item.clipType === 'audio' ? audioClip(item) : videoClip(item)
    case 'gap':
      return gap(item)
    case 'asset:effect:video':
    case 'asset:media:av':
      return item.toJSON()
  }
}

const baseNode = <T extends pub.AnyNode>(node: T, OTIO_SCHEMA = '') => {
  const { metadata, ...json } = node.toJSON() as ReturnType<T['toJSON']>

  return {
    OTIO_SCHEMA,
    name: node.name,
    enabled: node.enabled,
    color: node.color,
    effects: node.effects.map((effect): any => ({
      OTIO_SCHEMA: 'Effect.1',
      name: effect.assetId,
      effect_name: effect.assetId,
      metadata: { Miru: effect },
    })),
    metadata: { ...metadata, Miru: json },
  }
}

const timeline = (node: pub.Timeline) => ({
  ...baseNode(node, 'Stack.1'),
  name: 'tracks',
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
  }
}
const trackChild = <T extends pub.AnyTrackChild>(node: T, schemaName: string) => {
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

const clip = <T extends pub.AnyClip>(node: T) => {
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
  const otio = clip(node)

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
  const otio = clip(node)
  const json = otio.metadata.Miru

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

  return otio
}

const gap = (node: pub.Gap) => trackChild(node, 'Gap.1')
