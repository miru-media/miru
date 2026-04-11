import type { Schema } from '#core'
import type { Base } from '#schema'

const makeBase = <T extends Schema.AnyNode['type']>(
  id: string,
  type: T,
): Omit<Base, 'type'> & { type: T } => ({
  id,
  type,
  name: '',
  enabled: true,
  effects: [],
  color: undefined,
  metadata: {},
})

export const makeTimeline = (children: Schema.SerializedTimeline['children']): Schema.SerializedTimeline => ({
  ...makeBase('timeline', 'timeline'),
  id: 'timeline',
  children,
})
export const makeTrack = (
  id: string,
  trackType: Schema.SerializedTrack['trackType'],
  children: Schema.SerializedTrack['children'],
): Schema.SerializedTrack => ({
  ...makeBase(id, 'track'),
  trackType,
  children,
})

const makeBaseClip = <T extends Schema.AnyClip['type']>(id: string, type: T) => ({
  ...makeBase(id, type),
  sourceStart: { value: 0, rate: 1 },
  duration: { value: 1, rate: 1 },
})

export const makeVideoClip = (
  init: Partial<Omit<Schema.VideoClip, 'id' | 'type'>> & {
    id: string
  },
): Schema.VideoClip => ({
  ...makeBaseClip(init.id, 'clip:video'),
  ...init,
})

export const makeAudioClip = (
  init: Partial<Omit<Schema.AudioClip, 'id' | 'type'>> & {
    id: string
  },
): Schema.AudioClip => ({
  ...makeBaseClip(init.id, 'clip:audio'),
  ...init,
})

export const makeGap = (id: string, duration = 1) => ({
  ...makeBase(id, 'gap'),
  duration: { value: duration, rate: 1 },
})

export const makeAvAsset = (id: string, duration: number, uri?: string): Schema.MediaAsset => ({
  id,
  type: 'asset:media:av',
  mimeType: 'video/mp4',
  name: id,
  size: 1,
  duration,
  audio: {
    codec: 'aac',
    duration: { value: duration, rate: 1 },
    numberOfChannels: 2,
    sampleRate: 48000,
    firstTimestamp: { value: 0, rate: 1 },
  },
  video: {
    codec: 'avc',
    duration: { value: duration, rate: 1 },
    rotation: 0,
    width: 1920,
    height: 1080,
    frameRate: 25,
    firstTimestamp: { value: 0, rate: 1 },
  },
  uri,
})
