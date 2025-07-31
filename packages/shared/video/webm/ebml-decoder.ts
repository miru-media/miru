import type { Buffer as NodeBuffer } from 'node:buffer'

import { Buffer } from 'buffer/'
import * as ebml from 'ebml'

import type { EbmlChunk } from '../types.ts'

const TAG_RENAMES: Record<string, string | undefined> = {
  Timecode: 'Timestamp',
  TimecodeScale: 'TimestampScale',
  TrackTimecodeScale: 'TrackTimestampScale',
}

const fixTagName = (data: EbmlChunk[1]) => {
  data.name = TAG_RENAMES[data.name] ?? data.name
}

export class EbmlDecoder extends TransformStream<ArrayBufferLike, EbmlChunk> {
  constructor() {
    const decoder = new ebml.Decoder()
    super({
      transform(chunk) {
        decoder.write(Buffer.from(chunk) as unknown as NodeBuffer)
      },
      start: (controller) => {
        decoder.on('error', controller.error.bind(controller))

        decoder.on(
          'data',
          <T extends ebml.TagType>(chunk: ['start' | 'end', ebml.TagMetadata] | ['tag', ebml.Tag<T>]) => {
            const data = chunk[1]

            fixTagName(data)

            controller.enqueue(chunk)
          },
        )
      },
      flush() {
        decoder.end()
      },
    })
  }
}
