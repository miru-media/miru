import { promiseWithResolvers, timeout } from '../utils'

import { type Demuxer } from './Demuxer'
import { FrameExtractor } from './FrameExtractor'
import { assertDecoderConfigIsSupported } from './utils'

export class VideoDecoderExtractor extends FrameExtractor {
  decoder?: VideoDecoder
  demuxer: Demuxer
  #wasFlushed = false

  constructor(demuxer: Demuxer, options: FrameExtractor.Options) {
    super(options)
    this.demuxer = demuxer
  }

  async init() {
    await assertDecoderConfigIsSupported('video', this.videoInfo)
  }

  protected async _start(signal: AbortSignal) {
    const { demuxer } = this

    const endTimeUs = this.endTimeS * 1e6
    const p = promiseWithResolvers()

    const decoder = (this.decoder = new VideoDecoder({
      output: (frame) => {
        if (!signal.aborted && frame.timestamp <= endTimeUs) {
          this.onImage!(frame, frame.timestamp)
        } else frame.close()
      },
      error: (error) => p.reject(error),
    }))

    decoder.configure(this.videoInfo)

    demuxer.setExtractionOptions(
      this.videoInfo,
      (chunk) => {
        if (this.#wasFlushed) return
        decoder.decode(new EncodedVideoChunk(chunk))
      },
      p.resolve,
    )

    await p.promise
    if (decoder.state === 'configured') await decoder.flush()
  }

  async flush() {
    // allow some time for a decode error to surface
    await timeout(10)

    const { decoder } = this
    this.#wasFlushed = true
    await Promise.all([decoder?.state === 'configured' && decoder.flush(), super.flush()])
  }
}
