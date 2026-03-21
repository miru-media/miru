import type { Schema } from '#core'

import { makeAudioClip, makeGap, makeTrack, makeVideoClip } from './utils.ts'

export const simpleDocWithAudioVideoClips = () =>
  docWithTracks([
    makeTrack('track-0', 'video', [
      makeVideoClip({ id: 'clip-0-0', mediaRef: undefined }),
      makeVideoClip({ id: 'clip-0-1', mediaRef: undefined }),
    ]),
    makeTrack('track-1', 'audio', [
      makeAudioClip({ id: 'clip-1-0', mediaRef: undefined }),
      makeGap('gap-0-1'),
    ]),
  ])

export const docWithTracks = (tracks: Schema.SerializedTrack[]) =>
  ({
    resolution: { height: 1920, width: 1080 },
    frameRate: 25,
    assets: [],
    timeline: { id: 'timeline', type: 'timeline', children: tracks },
  }) satisfies Schema.SerializedDocument
