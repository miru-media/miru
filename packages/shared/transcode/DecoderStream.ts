import { type DemuxerChunkInfo } from 'shared/transcode/demuxer'

import { assertCanExtractVideoFrames, assertDecoderConfigIsSupported } from './utils'

const HIGH_WATER_MARK = 5

interface Options<T extends VideoFrame | AudioData> {
  chunks: DemuxerChunkInfo[]
  start: number
  end: number
  mute?: boolean
  config: T extends VideoFrame ? VideoDecoderConfig : AudioDecoderConfig
  credentials?: RequestCredentials
  crossOrigin?: 'anonymous' | 'use-credentials' | null
  signal?: AbortSignal
  onError: (error: unknown) => void
}

abstract class DecoderStream<T extends VideoFrame | AudioData> extends ReadableStream<T> {
  chunks: DemuxerChunkInfo[]
  options: Options<T>
  decoder: VideoDecoder | AudioDecoder
  done = false
  startUs: number
  endUs: number
  chunkIndex = 0
  _controller!: ReadableStreamDefaultController<T>
  _reader: ReadableStreamDefaultReader<T>
  _currentValue?: T

  constructor(options: Options<T>, decoder: AudioDecoder | VideoDecoder) {
    assertCanExtractVideoFrames()
    let _controller!: ReadableStreamDefaultController<T>

    super(
      {
        start: (controller) => (_controller = controller),
        pull: () => this.enqueueChunks(),
      },
      new CountQueuingStrategy({ highWaterMark: HIGH_WATER_MARK }),
    )

    this.chunks = options.chunks
    this.options = options
    this.decoder = decoder
    this.startUs = options.start * 1e6
    this.endUs = 1e6 * options.end
    this._controller = _controller
    this._reader = this.getReader()
  }

  _init() {
    const { decoder } = this
    const { config } = this.options
    ;(this.decoder.configure as (config: unknown) => void)(config)

    const { chunks } = this
    let startKeyframeIndex = 0

    for (let i = 0; i < chunks.length; i++) {
      const { type, timestamp } = chunks[i]
      if (timestamp > this.startUs) break
      if (type === 'key') startKeyframeIndex = i
    }

    this.chunkIndex = startKeyframeIndex

    decoder.addEventListener('dequeue', () => this.enqueueChunks())
    this.enqueueChunks()

    return this
  }

  abstract init(): Promise<this>
  abstract decode(chunk: DemuxerChunkInfo): void

  enqueueChunks() {
    const { chunks, decoder, done } = this
    if (done || decoder.state !== 'configured') return

    const desiredSize = this._controller.desiredSize ?? HIGH_WATER_MARK

    for (
      let nChunks = desiredSize - decoder.decodeQueueSize;
      this.chunkIndex < chunks.length && (nChunks > 0 || chunks[this.chunkIndex].type !== 'key');
      nChunks--
    )
      this.decode(chunks[this.chunkIndex++])
  }

  async read() {
    if (this.done) return

    this._currentValue?.close()
    this.enqueueChunks()
    this._currentValue = (await this._reader.read()).value
  }

  async flush() {
    if (this.decoder.state !== 'configured') return
    await this.decoder.flush()
  }

  dispose() {
    this.chunks = []
    if (this.decoder.state === 'configured') this.decoder.close()
    this._controller.close()
    this._currentValue?.close()
  }
}

export class VideoDecoderStream extends DecoderStream<VideoFrame> {
  declare decoder: VideoDecoder

  get currentValue() {
    return this._currentValue
  }

  constructor(options: Options<VideoFrame>) {
    const decoder = new VideoDecoder({
      output: (data) => {
        if (data.timestamp < this.startUs || this.done || options.signal?.aborted) {
          data.close()
          return
        }

        this._controller.enqueue(data)
        this.done = data.timestamp + data.duration! >= this.endUs

        if (this.done) if (decoder.state === 'configured') decoder.close()
      },
      error: options.onError,
    })

    super(options, decoder)
  }

  async init() {
    await assertDecoderConfigIsSupported('video', this.options.config)
    return super._init()
  }

  decode(chunk: DemuxerChunkInfo) {
    this.decoder.decode(new EncodedVideoChunk(chunk))
  }
}

export class AudioDecoderStream extends DecoderStream<AudioData> {
  declare decoder: AudioDecoder
  currentValue?: {
    timestamp: number
    duration: number
    numberOfFrames: number
    buffer: AudioBuffer
  }

  constructor(options: Options<AudioData>) {
    const decoder = new AudioDecoder({
      output: (data) => {
        const dataEndUs = data.timestamp + data.duration
        if (dataEndUs < this.startUs || this.done || options.signal?.aborted) {
          data.close()
          return
        }

        this._controller.enqueue(data)
        this.done = dataEndUs >= this.endUs

        if (this.done) {
          if (decoder.state === 'configured') decoder.close()
        }
      },
      error: options.onError,
    })

    super(options, decoder)
  }

  async init() {
    await assertDecoderConfigIsSupported('audio', this.options.config)
    return super._init()
  }

  decode(chunk: DemuxerChunkInfo) {
    this.decoder.decode(new EncodedAudioChunk(chunk))
  }

  async read() {
    if (this.done) this._currentValue = undefined
    else await super.read()
    const audioData = this._currentValue

    if (!audioData) {
      this.currentValue = undefined
      return
    }

    const { timestamp, duration, numberOfChannels, numberOfFrames, sampleRate } = audioData
    const buffer = new AudioBuffer({ length: numberOfFrames, numberOfChannels, sampleRate })

    for (let i = 0; i < numberOfChannels; i++) {
      audioData.copyTo(buffer.getChannelData(i), { planeIndex: i, format: 'f32-planar' })
    }

    this.currentValue = {
      timestamp,
      duration,
      buffer,
      numberOfFrames,
    }
  }
}
