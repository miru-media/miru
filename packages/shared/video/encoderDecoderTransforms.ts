import { win } from 'shared/utils'
import { type EncodedMediaChunk } from 'shared/video/types'

import { promiseWithResolvers } from '../utils'

export interface AudioBufferData {
  timestamp: number
  duration: number
  buffer: AudioBuffer
}

export abstract class CodecTransform<
  Processor extends AudioDecoder | AudioEncoder | VideoDecoder | VideoEncoder,
  In extends VideoFrame | AudioData | EncodedMediaChunk,
  Out = unknown,
> extends TransformStream<In, Out> {
  processor: Processor
  #backpressure?: ReturnType<typeof promiseWithResolvers<void>>

  constructor(createProcessor: (controller: TransformStreamDefaultController<Out>) => Processor) {
    let processor!: Processor

    super({
      start: (controller) => {
        processor = createProcessor(controller)
        processor.addEventListener('dequeue', () => this.#backpressure?.resolve())
      },
      transform: (chunk) => {
        const desiredSize = 5

        if (this.queueSize >= desiredSize) {
          return (this.#backpressure = promiseWithResolvers()).promise.then(() => {
            this.#backpressure = undefined
            this.process(chunk)
          })
        } else this.process(chunk)
      },
      flush: async () => {
        try {
          if (processor.state === 'configured') await processor.flush()
        } catch (error) {
          if ((error as Error | undefined)?.name !== 'AbortError') throw error
        }

        this.#backpressure?.resolve()
      },
    })

    this.processor = processor

    return this
  }

  abstract process(chunk: In): void
  abstract get queueSize(): number

  dispose() {
    if (this.processor.state === 'configured') this.processor.close()
  }
}

interface Options<T extends VideoFrame | AudioBufferData> {
  start: number
  end: number
  config: T extends VideoFrame ? VideoDecoderConfig : AudioDecoderConfig
  signal?: AbortSignal
}

abstract class DecoderTransform<
  Processor extends VideoDecoder | AudioDecoder,
  T extends VideoFrame | AudioBufferData,
> extends CodecTransform<Processor, EncodedMediaChunk, T> {
  options: Options<T>
  startUs: number
  endUs: number

  constructor(
    options: Options<T>,
    createDecoder: (controller: TransformStreamDefaultController<T>) => Processor,
  ) {
    super(createDecoder)

    this.options = options
    this.startUs = options.start * 1e6
    this.endUs = 1e6 * options.end

    return this
  }

  dispose() {
    if (this.processor.state === 'configured') this.processor.close()
  }

  get queueSize() {
    return this.processor.decodeQueueSize
  }
}

export class VideoDecoderTransform extends DecoderTransform<VideoDecoder, VideoFrame> {
  #doneDecoding = false

  constructor(options: Options<VideoFrame>) {
    super(options, (controller) => {
      const decoder = new VideoDecoder({
        output: (frame) => {
          if (this.#doneDecoding) {
            frame.close()
            return
          }

          if (frame.timestamp < this.startUs) {
            frame.close()
            return
          }

          const frameEndUs = frame.timestamp + (frame.duration ?? 0)

          if (frameEndUs <= this.endUs) controller.enqueue(frame)
          else frame.close()

          if (frameEndUs >= this.endUs) {
            if (decoder.state === 'configured') decoder.close()
            this.#doneDecoding = true
            controller.terminate()
          }
        },
        error: controller.error.bind(controller),
      })

      decoder.configure(options.config)

      return decoder
    })
  }

  process(chunk: EncodedMediaChunk) {
    if (this.#doneDecoding) return
    this.processor.decode(new EncodedVideoChunk(chunk))
  }
}

export class AudioDecoderTransform extends DecoderTransform<AudioDecoder, AudioBufferData> {
  #doneDecoding = false

  constructor(options: Options<AudioBufferData>) {
    super(options, (controller) => {
      const decoder = new AudioDecoder({
        output: (audioData) => {
          const dataEndUs = audioData.timestamp + audioData.duration
          if (dataEndUs < this.startUs) {
            audioData.close()
            return
          }

          const { timestamp, duration, numberOfChannels, numberOfFrames, sampleRate } = audioData

          if (numberOfFrames === 0) return

          const buffer = new AudioBuffer({ length: numberOfFrames, numberOfChannels, sampleRate })

          for (let i = 0; i < numberOfChannels; i++)
            audioData.copyTo(buffer.getChannelData(i), { planeIndex: i, format: 'f32-planar' })

          audioData.close()

          controller.enqueue({
            timestamp,
            duration,
            buffer,
          })

          if (dataEndUs >= this.endUs) {
            if (decoder.state === 'configured') decoder.close()
            this.#doneDecoding = true
            controller.terminate()
            this.#doneDecoding = true
          }
        },
        error: controller.error.bind(controller),
      })

      decoder.configure(options.config)

      return decoder
    })
  }

  process(chunk: EncodedMediaChunk) {
    if (this.#doneDecoding) return
    this.processor.decode(new EncodedAudioChunk(chunk))
  }
}

export class VideoEncoderTransform extends CodecTransform<
  VideoEncoder,
  VideoFrame,
  [chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata]
> {
  constructor(config: VideoEncoderConfig) {
    super((controller) => {
      const encoder = new VideoEncoder({
        output: (chunk, meta) => controller.enqueue([chunk, meta]),
        error: controller.error.bind(controller),
      })
      encoder.configure(config)
      return encoder
    })
  }

  process(chunk: VideoFrame) {
    this.processor.encode(chunk)
  }
  get queueSize() {
    return this.processor.encodeQueueSize
  }
}

export class AudioEncoderTransform extends CodecTransform<
  AudioEncoder,
  AudioData,
  [chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata]
> {
  AudioEncoder: typeof window.AudioEncoder

  constructor(config: AudioEncoderConfig, AudioEncoder = win.AudioEncoder) {
    super((controller) => {
      const encoder = new AudioEncoder({
        output: (chunk, meta) => controller.enqueue([chunk, meta]),
        error: controller.error.bind(controller),
      })
      encoder.configure(config)
      return encoder
    })

    this.AudioEncoder = AudioEncoder
  }

  process(chunk: AudioData) {
    this.processor.encode(chunk)
  }
  get queueSize() {
    return this.processor.encodeQueueSize
  }
}
