import type * as ebml from 'ebml'
import ebmlBlock from 'ebml-block'

import {
  type AudioMetadata,
  type EbmlChunk,
  type EncodedMediaChunk,
  type MediaContainerMetadata,
  type VideoMetadata,
  type WebmTrack,
} from '../types'

interface TrackState {
  track: VideoMetadata | AudioMetadata
  codedWidth: number
  codedHeight: number
}

export class EncodedChunkExtractor extends TransformStream<
  EbmlChunk,
  [EncodedMediaChunk, VideoMetadata | AudioMetadata]
> {
  #trackStates: Record<number, TrackState | undefined> = {}
  metadata!: MediaContainerMetadata

  constructor() {
    let clusterTimestampTicks = 0

    super({
      transform: (chunk, controller) => {
        if (chunk[0] !== 'tag') return

        const data = chunk[1]

        switch (data.name) {
          case 'Timestamp':
            clusterTimestampTicks = data.value as number
            break
          case 'SimpleBlock': {
            const block = data as unknown as ebml.SimpleBlock
            let state = this.#trackStates[block.track]

            if (!state) {
              let codedWidth = 0
              let codedHeight = 0

              const { video, audio } = this.metadata
              const track = video?.id === block.track ? video : audio?.id === block.track ? audio : undefined
              if (!track) return

              if (track.type === 'video') {
                ;({ codedWidth, codedHeight } = track)
              }

              state = this.#trackStates[block.track] = {
                track,
                codedWidth,
                codedHeight,
              }
            }

            const { track, codedWidth, codedHeight } = state
            const rawTrack = track.track as WebmTrack
            const durationUs = track.type === 'video' ? 1e6 / track.fps : undefined
            const timestampUs =
              ((clusterTimestampTicks + block.value * rawTrack.TrackTimestampScale) *
                rawTrack.TimestampScale) /
              1e3

            const { frames } = ebmlBlock(block.data)

            frames.forEach((frame) => {
              const chunk: EncodedMediaChunk = {
                ...track,
                duration: durationUs,
                codedWidth,
                codedHeight,
                data: frame,
                type: block.keyframe ? 'key' : 'delta',
                timestamp: timestampUs,
                mediaType: track.type,
              }

              controller.enqueue([chunk, track])
            })

            break
          }
        }
      },
    })
  }
}
