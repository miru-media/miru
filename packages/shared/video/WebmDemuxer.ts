import {
  type AudioMetadata,
  type DemuxerSampleCallback,
  type EbmlChunk,
  type MediaChunk,
  type MediaContainerMetadata,
  type VideoMetadata,
} from 'shared/video/types'

import { EbmlDecoder } from './webm/EbmlDecoder'
import { EncodedChunkExtractor } from './webm/EncodedChunkExtractor'
import { MetadataExtractor } from './webm/ExtractMetadata'

export class WebmDemuxer {
  #abort = new AbortController()
  #ebmlStream?: ReadableStream<EbmlChunk>
  encodedChunkExtractor = new EncodedChunkExtractor()
  #sampleExtractionStates: Record<
    string,
    { onSample: DemuxerSampleCallback; onDone?: () => void; isDone: boolean } | undefined
  > = {}

  async init(url: string, requestInit?: RequestInit): Promise<MediaContainerMetadata> {
    requestInit?.signal?.addEventListener('abort', () => this.#abort.abort(), { once: true })
    const response = await fetch(url, { ...requestInit, signal: this.#abort.signal })

    if (!response.ok || !response.body) throw new Error(`Invalid response from "${url}".`)

    const contentType = response.headers.get('content-type')
    if (contentType && !/video\/(webm|matroska|x-matroska)/.test(contentType))
      throw new Error(`Unexpected content-type: "${contentType}"`)

    const [ebmlStream, forMetadata] = response.body.pipeThrough(new EbmlDecoder()).tee()
    this.#ebmlStream = ebmlStream

    const metadata = await new Promise<MediaContainerMetadata>((resolve, reject) => {
      forMetadata
        .pipeThrough(new MetadataExtractor())
        .pipeTo(new WritableStream({ write: resolve }, { highWaterMark: 1 }), { signal: this.#abort.signal })
        .catch(reject)
    })
    this.encodedChunkExtractor.metadata = metadata

    return metadata
  }

  setExtractionOptions(
    track: VideoMetadata | AudioMetadata,
    onSample: DemuxerSampleCallback,
    onDone?: () => void,
  ) {
    this.#sampleExtractionStates[track.id] = { onSample, onDone, isDone: false }
  }

  async start(_firstFrameTimeS?: number, lastFrameTimeS?: number) {
    lastFrameTimeS ??= this.encodedChunkExtractor.metadata.duration

    const sink = {
      write: (chunk: [MediaChunk, VideoMetadata | AudioMetadata]) => {
        const encodedChunk = chunk[0]
        const track = chunk[1]

        const state = this.#sampleExtractionStates[track.id]
        if (!state) return
        state.onSample(encodedChunk)

        if (
          encodedChunk.timestamp + (encodedChunk.duration ?? 0) >= lastFrameTimeS * 1e6 &&
          encodedChunk.type === 'key'
        ) {
          state.onDone?.()
          state.isDone = true
          if (Object.values(this.#sampleExtractionStates).every((state) => !!state?.isDone))
            this.#abort.abort()
        }
      },
      close: () => {
        Object.values(this.#sampleExtractionStates).forEach(
          (state) => state?.isDone === false && state.onDone?.(),
        )
      },
    }

    await this.#ebmlStream!.pipeThrough(this.encodedChunkExtractor, {
      signal: this.#abort.signal,
    })
      .pipeTo(new WritableStream(sink))
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      .catch((error: unknown) => (this.#abort.signal.aborted ? undefined : Promise.reject(error)))
  }

  stop() {
    this.#abort.abort('stopped')
  }
}
