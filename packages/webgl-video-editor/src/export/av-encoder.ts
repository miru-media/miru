import * as Mb from 'mediabunny'

import { win } from 'shared/utils'
import { AudioEncoderTransform, VideoEncoderTransform } from 'shared/video/coder-transforms'
import { assertEncoderConfigIsSupported } from 'shared/video/utils'

import { EXPORT_VIDEO_CODECS } from '../constants.ts'

import type { EncodedAudioChunk as EncodedAudioChunkPolyfill } from './polyfill.ts'

export namespace AVEncoder {
  export interface Options {
    video?: VideoOptions
    audio?: AudioOptions
    onOutput?: (type: 'audio' | 'video', timestamp: number) => void
  }
  export interface VideoOptions extends VideoEncoderConfig {
    rotation?: Mb.Rotation
  }

  export interface AudioOptions extends Omit<AudioEncoderConfig, 'codec'> {
    codec: 'opus' | 'aac'
  }
}

export class AVEncoder {
  readonly #options: AVEncoder.Options
  #video?: {
    transform: VideoEncoderTransform
    source: Mb.EncodedVideoPacketSource
    promise?: Promise<void>
  }
  #audio?: {
    transform: AudioEncoderTransform
    source: Mb.EncodedAudioPacketSource
    promise?: Promise<void>
  }
  output!: Mb.Output<Mb.OutputFormat, Mb.BufferTarget>
  onOutput?: (type: 'audio' | 'video', timestamp: number) => void
  firstVideoFrameTimeUs?: number

  AudioData = win.AudioData

  get video() {
    return this.#video?.transform.writable
  }
  get audio() {
    return this.#audio?.transform.writable
  }

  constructor(options: AVEncoder.Options) {
    this.#options = options
  }

  async init() {
    const options = this.#options
    let outputFormat: Mb.OutputFormat | undefined

    if (options.video) {
      let lastError: unknown

      const config = { ...options.video }
      for (const checkCodec of [config.codec, ...EXPORT_VIDEO_CODECS]) {
        config.codec = checkCodec
        try {
          await assertEncoderConfigIsSupported('video', config)
          break
        } catch (error) {
          lastError = error
        }
      }

      let codecName: 'avc' | 'vp9' | undefined
      if (config.codec.startsWith('avc')) {
        codecName = 'avc'
        outputFormat = new Mb.Mp4OutputFormat()
      } else if (config.codec.startsWith('vp09')) {
        codecName = 'vp9'
        outputFormat = new Mb.WebMOutputFormat()
      }

      if (!config.codec || !codecName)
        throw new Error(
          `[webgl-video-editor] No supported video codecs from the list ${EXPORT_VIDEO_CODECS.join()}`,
          { cause: lastError },
        )

      const transform = new VideoEncoderTransform(config)
      const source = new Mb.EncodedVideoPacketSource(codecName)

      const promise = transform.readable
        .pipeTo(
          new WritableStream({
            write: async ([chunk, meta]) => {
              this.firstVideoFrameTimeUs ??= chunk.timestamp

              const data = new Uint8Array(chunk.byteLength)
              chunk.copyTo(data)

              const { type, timestamp, duration } = chunk
              const packet = new Mb.EncodedPacket(data, type, timestamp / 1e6, duration! / 1e6)
              await source.add(packet, meta)

              this.#options.onOutput?.('video', chunk.timestamp)
            },
          }),
        )
        .finally(() => source.close())

      this.#video = { transform, source, promise }
    }

    if (options.audio) {
      let { AudioEncoder } = win
      const useAudioEncoderPolyfil = typeof AudioEncoder !== 'function'

      if (useAudioEncoderPolyfil) {
        const polyfill = await import('./polyfill.ts')
        await polyfill.init()
        ;({ AudioEncoder } = polyfill)
        this.AudioData = polyfill.AudioData
      }

      await Promise.all([assertEncoderConfigIsSupported('audio', options.audio, AudioEncoder)])

      const transform = new AudioEncoderTransform(options.audio, AudioEncoder)
      const source = new Mb.EncodedAudioPacketSource(options.audio.codec)

      let hasFirstChunk = false
      let firstTimetsamp = 0

      const promise = transform.readable
        .pipeTo(
          new WritableStream({
            write: async ([chunk, meta]) => {
              if (!hasFirstChunk) {
                hasFirstChunk = true
                firstTimetsamp = chunk.timestamp
              }

              const timestamp = chunk.timestamp - firstTimetsamp
              let data: Uint8Array

              if (useAudioEncoderPolyfil)
                data = (chunk as unknown as EncodedAudioChunkPolyfill)._libavGetData()
              else {
                data = new Uint8Array(chunk.byteLength)
                chunk.copyTo(data)
              }

              const packet = new Mb.EncodedPacket(data, chunk.type, timestamp / 1e6, chunk.duration! / 1e6)
              await source.add(packet, meta)
              this.onOutput?.('audio', timestamp)
            },
          }),
        )
        .finally(() => source.close())

      this.#audio = { transform, source, promise }
    }

    const output = (this.output = new Mb.Output({
      format: outputFormat ?? new Mb.Mp4OutputFormat(),
      target: new Mb.BufferTarget(),
    }))

    if (this.#video) output.addVideoTrack(this.#video.source)
    if (this.#audio) output.addAudioTrack(this.#audio.source)

    await this.output.start()

    return this
  }

  async flush() {
    await Promise.all([this.#video?.promise, this.#audio?.promise])
  }

  async finalize() {
    const { output } = this
    await output.finalize()
    return output.target.buffer!
  }
}
