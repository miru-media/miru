import type { Schema } from '#core'

export const makeTrack = (
  id: string,
  trackType: Schema.SerializedTrack['trackType'],
  children: Schema.SerializedTrack['children'],
): Schema.SerializedTrack => ({
  id,
  type: 'track',
  trackType,
  children,
})

export const makeClip = (
  init: Partial<Omit<Schema.SerializedClip, 'id' | 'type' | 'sourceRef'>> & {
    id: string
    sourceRef: Schema.SerializedClip['sourceRef']
  },
): Schema.SerializedClip => ({
  type: 'clip',
  clipType: 'audio',
  duration: 1,
  sourceStart: 0,
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
