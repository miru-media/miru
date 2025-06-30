import { MP4Demuxer } from './mp4/mp4-demuxer'
import { type AudioMetadata, type MediaContainerMetadata, type VideoMetadata } from './types'
import { WebmDemuxer } from './webm/webm-demuxer'

export class Demuxer {
  #demuxer?: MP4Demuxer | WebmDemuxer
  async init(
    source: ReadableStream<Uint8Array> | Blob | string,
    requestInit?: RequestInit,
  ): Promise<MediaContainerMetadata> {
    const isUrl = typeof source === 'string'
    const isStream = !isUrl && 'getReader' in source
    let sourceStream: ReadableStream<Uint8Array>

    if (isStream) sourceStream = source
    else if (isUrl) {
      const response = await fetch(source, requestInit)
      if (!response.ok || !response.body) throw new Error(`Invalid response from "${typeof source}".`)

      sourceStream = response.body
    } else sourceStream = source.stream()

    const teed = sourceStream.tee()
    sourceStream = teed[0]

    const reader = teed[1].getReader()
    const { value: fileBytes } = await reader.read()
    reader.cancel().catch(() => undefined)

    if (!fileBytes) throw new Error(`Couldn't read source stream.`)
    if (fileBytes.length === 1) throw new Error('TODO')

    const SpecificDemuxer = [WebmDemuxer, MP4Demuxer].find(({ signature }) => signature.check(fileBytes))
    if (!SpecificDemuxer) throw new Error(`Unsupported media file type.`)

    this.#demuxer = new SpecificDemuxer()

    return this.#demuxer.init(sourceStream)
  }

  getChunkStream(track: VideoMetadata | AudioMetadata, firstFrameTimeS?: number, lastFrameTimeS?: number) {
    return this.#demuxer!.getChunkStream(track, firstFrameTimeS, lastFrameTimeS)
  }

  start() {
    this.#demuxer!.start()
  }

  stop() {
    this.#demuxer?.stop()
  }
}
