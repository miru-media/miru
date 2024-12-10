import { type DemuxerChunkInfo } from 'shared/transcode/demuxer'

import { assertCanExtractVideoFrames, assertDecoderConfigIsSupported } from './utils'

const HIGH_WATER_MARK = 5

interface Options {
  start: number
  end: number
  mute?: boolean
  videoConfig: VideoDecoderConfig
  credentials?: RequestCredentials
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  signal?: AbortSignal
  onError: (error: unknown) => void
}

export class DecoderStream extends TransformStream<DemuxerChunkInfo, VideoFrame> {
  samples: DemuxerChunkInfo[]
  options: Options
  decoder: VideoDecoder
  done = false
  startUs: number
  endUs: number
  sampleIndex = 0
  _controller!: TransformStreamDefaultController<VideoFrame>
  _writer: WritableStreamDefaultWriter<DemuxerChunkInfo>
  _reader: ReadableStreamDefaultReader<VideoFrame>

  constructor(samples: DemuxerChunkInfo[], options: Options) {
    assertCanExtractVideoFrames()
    let _controller!: TransformStreamDefaultController<VideoFrame>
    const decoder = new VideoDecoder({
      output: (frame) => {
        if (frame.timestamp < this.startUs || this.done || options.signal?.aborted) {
          frame.close()
          return
        }

        this._controller.enqueue(frame)
        this.done = frame.timestamp + frame.duration! >= this.endUs

        if (this.done) {
          this._writer.close().catch(() => undefined)
          if (decoder.state === 'configured') decoder.close()
        }
      },
      error: options.onError,
    })

    super(
      {
        start: (controller) => (_controller = controller),
        transform: (sample) => decoder.decode(new EncodedVideoChunk(sample)),
      },
      new CountQueuingStrategy({ highWaterMark: HIGH_WATER_MARK }),
      new CountQueuingStrategy({ highWaterMark: HIGH_WATER_MARK }),
    )

    this.samples = samples
    this.options = options
    this.decoder = decoder
    this.startUs = options.start * 1e6
    this.endUs = 1e6 * options.end
    this._controller = _controller
    this._writer = this.writable.getWriter()
    this._reader = this.readable.getReader()
  }

  async init() {
    const { decoder } = this
    const { videoConfig } = this.options
    await assertDecoderConfigIsSupported(videoConfig)
    decoder.configure(videoConfig)

    const { samples } = this
    let startKeyframeIndex = 0

    for (let i = 0; i < samples.length; i++) {
      const { type, timestamp } = samples[i]
      if (timestamp > this.startUs) break
      if (type === 'key') startKeyframeIndex = i
    }

    this.sampleIndex = startKeyframeIndex

    decoder.addEventListener('dequeue', () => this.enqueueSamples())
    this.enqueueSamples()
  }

  enqueueSamples() {
    const { samples, decoder, done } = this
    if (done || decoder.state !== 'configured') return

    const desiredSize = this._controller.desiredSize ?? HIGH_WATER_MARK

    for (
      let nSamples = desiredSize - decoder.decodeQueueSize;
      nSamples > 0 && this.sampleIndex < samples.length;
      nSamples--
    )
      this._writer.write(samples[this.sampleIndex++]).catch((error: unknown) => this._controller.error(error))
  }

  read() {
    this.enqueueSamples()
    return this._reader.read()
  }

  async flush() {
    if (this.done) return
    await this.decoder.flush()
  }

  dispose() {
    this.samples = []
    if (this.decoder.state === 'configured') this.decoder.close()
    this._controller.terminate()
  }
}
