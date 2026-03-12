import type { Schema } from '#core'
import type { Base } from '#schema'

const makeBase = <T extends string>(id: string, type: T): Base & { type: T } => ({
  id,
  type,
  name: '',
  enabled: true,
  effects: [],
  metadata: {},
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

const makeBaseClip = <T extends Schema.BaseClip['clipType']>(id: string, clipType: T) => ({
  ...makeBase(id, 'clip'),
  clipType,
  duration: 1,
  sourceStart: 0,
})

export const makeVideoClip = (
  init: Partial<Omit<Schema.VideoClip, 'id' | 'type'>> & {
    id: string
  },
): Schema.VideoClip => ({
  ...makeBaseClip(init.id, 'video'),
  ...init,
})

export const makeAudioClip = (
  init: Partial<Omit<Schema.AudioClip, 'id' | 'type'>> & {
    id: string
  },
): Schema.AudioClip => ({
  ...makeBaseClip(init.id, 'audio'),
  ...init,
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
    duration,
    numberOfChannels: 2,
    sampleRate: 48000,
    firstTimestamp: 0,
  },
  video: {
    codec: 'avc',
    duration,
    rotation: 0,
    width: 1920,
    height: 1080,
    frameRate: 25,
    firstTimestamp: 0,
  },
  uri,
})
