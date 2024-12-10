import { type Muxer } from 'mp4-muxer'

import { assertEncoderConfigIsSupported } from 'shared/transcode/utils'

interface VideoInfo {
  width: number
  height: number
  fps: number
}

export class Encoder {
  config: VideoEncoderConfig
  videoInfo: VideoInfo
  muxer: Muxer<any>
  onOutput?: (timestamp: number) => void
  onError: (error: unknown) => void
  encoder?: VideoEncoder
  firstVideoFrameTimeUs?: number

  constructor(options: {
    config?: VideoEncoderConfig
    videoInfo: VideoInfo
    muxer: Muxer<any>
    onOutput?: (timestamp: number) => void
    onError: (error: unknown) => void
  }) {
    this.videoInfo = options.videoInfo
    this.muxer = options.muxer
    this.onOutput = options.onOutput
    this.onError = options.onError

    const { config } = options
    const { width, height, fps } = options.videoInfo
    const MAX_AREA_LEVEL_30 = 1280 * 720
    const {
      codec = `avc1.4200${(width * height > MAX_AREA_LEVEL_30 ? 40 : 31).toString(16)}`,
      bitrate = 1e6,
    } = config ?? {}

    this.config = { codec, width, height, bitrate, framerate: fps }
  }

  async init() {
    await assertEncoderConfigIsSupported(this.config)

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (this.firstVideoFrameTimeUs === undefined) this.firstVideoFrameTimeUs = chunk.timestamp
        this.muxer.addVideoChunk(chunk, meta, chunk.timestamp - this.firstVideoFrameTimeUs)
        this.onOutput?.(chunk.timestamp)
      },
      error: this.onError,
    })

    this.encoder.configure(this.config)
    return this
  }
  
  encode(data: VideoFrame, options?: VideoEncoderEncodeOptions) {
    this.encoder?.encode(data, options)
  }

  async flush() {
    await this.encoder?.flush().catch(() => undefined)
  }

  dispose() {
    if (this.encoder?.state === 'configured') this.encoder.close()
  }
}
