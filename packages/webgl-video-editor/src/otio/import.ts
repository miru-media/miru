import { uid } from 'uid'

import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION } from '#constants'
import type * as pub from '#core'
import type { Schema } from '#core'

import type { Otio } from './export.ts'

const plainRational = ({ value, rate }: { value: number; rate: number }) => ({ value, rate })

export const documentJSONFromOTIO = (otio: Otio.TimelineDocument): Schema.SerializedDocument => {
  const { Miru: docMetadata, ...metadata } = otio.metadata ?? {}

  const settings: Schema.DocumentSettings = {
    resolution: docMetadata?.resolution ?? DEFAULT_RESOLUTION,
    frameRate: docMetadata?.frameRate ?? DEFAULT_FRAMERATE,
  }

  return {
    metadata,
    ...settings,
    assets: docMetadata?.assets ?? [],
    timeline: timelineStack(otio.tracks),
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

const timelineStack = (item: Otio.TimelineStack): Schema.SerializedTimeline => ({
  ...baseNode(item, 'timeline'),
  id: 'timeline',
  children: item.children.map(track),
})

const track = (item: Otio.Track): Schema.SerializedTrack => {
  const trackType = item.kind === 'Audio' ? 'audio' : 'video'

  return {
    ...baseNode(item, 'track'),
    trackType,
    children: item.children.map((child) =>
      child.OTIO_SCHEMA === 'Gap.1' ? gap(child) : (trackType === 'audio' ? audioClip : videoClip)(child),
    ),
  }
}
const trackChild = <TO extends Otio.Clip | Otio.Gap, TT extends (Schema.AnyClip | Schema.Gap)['type']>(
  item: TO,
  type: TT,
) => ({
  ...baseNode(item, type),
  duration: plainRational(item.source_range.duration),
})

const clip = <T extends Otio.Clip, TT extends Schema.AnyClip['type']>(item: T, type: TT) => ({
  ...trackChild(item, type),
  sourceStart: plainRational(item.source_range.start_time),
  mediaRef: item.media_reference.metadata.Miru,
})

const audioClip = (item: Otio.Clip): Schema.AudioClip => {
  const json: Schema.AudioClip = clip(item, 'clip:audio')
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

const videoClip = (item: Otio.Clip): Schema.VideoClip => {
  const json: Schema.VideoClip = clip(item, 'clip:video')

  const transform = item.effects.find((e: any) => e.effect_name === 'SpatialTransformEffect')

  json.translate = transform?.translate
  json.rotate = transform?.rotate
  json.scale = transform?.scale

  return json
}

const gap = (item: Otio.Gap): Schema.SerializedGap => trackChild(item, 'gap')
