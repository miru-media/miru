import { promiseWithResolvers, timeout } from '@/utils'

import { type MP4Demuxer } from './demuxer'
import { FrameExtractor } from './FrameExtractor'
import { assertDecoderConfigIsSupported } from './utils'

export class VideoDecoderExtractor extends FrameExtractor {
  rvfcHandle = 0
  decoder?: VideoDecoder
  config!: VideoDecoderConfig
  demuxer: MP4Demuxer

  constructor(demuxer: MP4Demuxer, options: FrameExtractor.Options) {
    super(options)
    this.demuxer = demuxer
  }

  async init() {
    const config = (this.config = this.demuxer.getConfig(this.track))
    await assertDecoderConfigIsSupported(config)
  }

  protected async _start(onFrame: FrameExtractor.OnFrame, signal: AbortSignal) {
    const { demuxer } = this

    const endTimeUs = this.endTimeS * 1e6
    const p = promiseWithResolvers()

    const decoder = (this.decoder = new VideoDecoder({
      output(frame) {
        if (!signal.aborted && frame.timestamp <= endTimeUs) onFrame(frame, frame.timestamp)
        frame.close()
      },
      error: (error) => p.reject(error),
    }))

    decoder.configure(this.config)
    demuxer.setExtractionOptions(this.track, decoder.decode.bind(decoder), p.resolve)

    await p.promise
  }

  async flush() {
    // allow some time for a decode error to surface
    await timeout(10)

    const { decoder } = this
    await Promise.all([decoder?.state === 'configured' && decoder.flush(), super.flush()])
  }
}
