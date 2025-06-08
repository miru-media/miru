import { MP4Demuxer } from './Mp4Demuxer'
import {
  type AudioMetadata,
  type DemuxerSampleCallback,
  type MediaContainerMetadata,
  type VideoMetadata,
} from './types'
import { WebmDemuxer } from './WebmDemuxer'

export class Demuxer {
  #demuxer!: MP4Demuxer | WebmDemuxer
  async init(source: Blob | string, requestInit?: RequestInit): Promise<MediaContainerMetadata> {
    const isBlob = typeof source !== 'string'
    const url = isBlob ? URL.createObjectURL(source) : source
    let fileType: string | null = null

    if (isBlob) fileType = source.type
    else {
      const method = url.startsWith('blob:') ? 'GET' : 'HEAD'
      const res = await fetch(url, { ...requestInit, method })
      fileType = res.headers.get('content-type')
    }

    const containerType = fileType && /video\/(webm|matroska|x-matroska)/.test(fileType) ? 'webm' : 'mp4'

    this.#demuxer = containerType === 'webm' ? new WebmDemuxer() : new MP4Demuxer()

    return this.#demuxer.init(url, requestInit)
  }

  setExtractionOptions(
    track: VideoMetadata | AudioMetadata,
    onSample: DemuxerSampleCallback,
    onDone?: () => void,
  ) {
    this.#demuxer.setExtractionOptions(track as any, onSample, onDone)
  }

  start(firstFrameTimeS?: number, lastFrameTimeS?: number) {
    return this.#demuxer.start(firstFrameTimeS, lastFrameTimeS)
  }

  stop() {
    this.#demuxer.stop()
  }
}
