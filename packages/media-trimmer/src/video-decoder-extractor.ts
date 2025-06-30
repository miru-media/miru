import { type Demuxer } from 'shared/video/demuxer'
import { VideoDecoderTransform } from 'shared/video/coder-transforms'

import { FrameExtractor } from './frame-extractor'

export class VideoDecoderExtractor extends FrameExtractor {
  demuxer: Demuxer

  constructor(demuxer: Demuxer, options: FrameExtractor.Options) {
    super(options)
    this.demuxer = demuxer
  }

  protected _start(signal?: AbortSignal) {
    const { demuxer, startTimeS, endTimeS } = this

    return demuxer
      .getChunkStream(this.videoInfo, startTimeS, endTimeS)
      .pipeThrough(new VideoDecoderTransform({ start: startTimeS, end: endTimeS, config: this.videoInfo }))
      .pipeThrough(
        new TransformStream({
          transform: (frame, controller) => {
            controller.enqueue(this.onImage!(frame, frame.timestamp))
          },
        }),
        { signal },
      )
  }
}
