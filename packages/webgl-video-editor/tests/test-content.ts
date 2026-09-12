import type { Schema } from '#core'

import { makeAudioClip, makeAudioTrack, makeVideoClip, makeVideoTrack } from './utils.ts'

export const simpleDocWithAudioVideoClips = () =>
  docWithTracks([
    makeVideoTrack('track-0', [
      makeVideoClip({ id: 'clip-0-0', mediaRef: undefined }),
      makeVideoClip({ id: 'clip-0-1', mediaRef: undefined }),
    ]),
    makeAudioTrack('track-1', [makeAudioClip({ id: 'clip-1-0', mediaRef: undefined })]),
  ])

export const docWithTracks = (tracks: Schema.AnySerializedTrack[]) =>
  ({
    resolution: { height: 1920, width: 1080 },
    frameRate: 25,
    assets: [],
    timeline: { id: 'timeline', type: 'timeline', children: tracks },
    links: [],
  }) satisfies Schema.SerializedDocument
