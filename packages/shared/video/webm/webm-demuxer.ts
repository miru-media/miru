import type {
  AudioMetadata,
  EbmlChunk,
  EncodedMediaChunk,
  MediaContainerMetadata,
  VideoMetadata,
} from 'shared/video/types'

import { FileSignature } from '../file-signature.ts'

import { EbmlDecoder } from './ebml-decoder.ts'
import { EncodedChunkExtractor } from './encoded-chunk-extractor.ts'
import { MetadataExtractor } from './metadata-extractor.ts'

export class WebmDemuxer {
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- file signature magic numbers
  static signature = new FileSignature(0, new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))

  readonly #abort = new AbortController()
  #ebmlStream?: ReadableStream<EbmlChunk>
  encodedChunkExtractor = new EncodedChunkExtractor()
  #sampleExtractionStates: Record<
    string,
    | {
        isDone: boolean
        firstFrameTimeUs: number
        lastFrameTimeUs: number
        transform: TransformStream<[EncodedMediaChunk, VideoMetadata | AudioMetadata], EncodedMediaChunk>
      }
    | undefined
  > = {}

  async init(source: ReadableStream<Uint8Array>): Promise<MediaContainerMetadata> {
    const [ebmlStream, forMetadata] = source.pipeThrough(new EbmlDecoder()).tee()
    this.#ebmlStream = ebmlStream

    const metadata = (
      await forMetadata
        .pipeThrough(new MetadataExtractor(), { signal: this.#abort.signal })
        .getReader()
        .read()
    ).value

    if (!metadata) throw new Error(`Couldn't find WebM container metadata.`)

    return (this.encodedChunkExtractor.metadata = metadata)
  }

  getChunkStream(track: VideoMetadata | AudioMetadata, firstFrameTimeS = 0, lastFrameTimeS = Infinity) {
    const lastFrameTimeUs = lastFrameTimeS * 1e6
    const state = (this.#sampleExtractionStates[track.id] = {
      isDone: false,
      firstFrameTimeUs: firstFrameTimeS * 1e6,
      lastFrameTimeUs,
      transform: new TransformStream({
        transform: (chunk, controller) => {
          if (chunk[1].id !== track.id) return
          const encodedChunk = chunk[0]
          controller.enqueue(encodedChunk)

          if (
            encodedChunk.timestamp + (encodedChunk.duration ?? 0) >= lastFrameTimeUs * 1e6 &&
            encodedChunk.type === 'key'
          ) {
            controller.terminate()
          }
        },
      }),
    })

    return state.transform.readable
  }

  start() {
    let _chunkStream = this.encodedChunkExtractor.readable

    Object.values(this.#sampleExtractionStates).forEach((state, i, states) => {
      let currentStream = _chunkStream

      if (i < states.length - 1) [currentStream, _chunkStream] = _chunkStream.tee()

      currentStream.pipeThrough(state!.transform)
    })

    this.#ebmlStream!.pipeThrough(this.encodedChunkExtractor, { signal: this.#abort.signal })
  }

  stop() {
    this.#abort.abort('stopped')
  }
}
