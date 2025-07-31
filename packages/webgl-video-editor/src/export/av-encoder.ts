import { ArrayBufferTarget, Muxer, type MuxerOptions } from 'mp4-muxer'

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
    rotation?: Required<MuxerOptions<ArrayBufferTarget>>['video']['rotation']
  }

  export interface AudioOptions extends Omit<AudioEncoderConfig, 'codec'> {
    codec: 'opus' | 'aac'
  }
}

export class AVEncoder {
  readonly #options: AVEncoder.Options
  #video?: {
    config: AVEncoder.VideoOptions
    transform: VideoEncoderTransform
    promise?: Promise<void>
  }
  #audio?: {
    config: AVEncoder.AudioOptions
    transform: AudioEncoderTransform
    promise?: Promise<void>
  }
  muxer!: Muxer<ArrayBufferTarget>
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

    if (options.video) {
      this.#video = {
        config: options.video,
        transform: new VideoEncoderTransform(options.video),
        promise: undefined,
      }
      const video = this.#video

      let lastError: unknown

      for (const codec of EXPORT_VIDEO_CODECS) {
        video.config.codec = codec
        try {
          await assertEncoderConfigIsSupported('video', video.config)
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!video.config.codec) throw lastError as Error

      video.promise = video.transform.readable.pipeTo(
        new WritableStream({
          write: ([chunk, meta]) => {
            this.firstVideoFrameTimeUs ??= chunk.timestamp
            this.muxer.addVideoChunk(chunk, meta, chunk.timestamp - this.firstVideoFrameTimeUs)
            this.#options.onOutput?.('video', chunk.timestamp)
          },
        }),
      )
    }

    if (options.audio) {
      let { AudioEncoder } = win
      const useAudioEncoderPolyfil = typeof AudioEncoder !== 'function'

      if (useAudioEncoderPolyfil) {
        const polyfill = await import('./polyfill.ts')
        await polyfill.init()
        AudioEncoder = polyfill.AudioEncoder as typeof AudioEncoder
        this.AudioData = polyfill.AudioData
      }

      await Promise.all([assertEncoderConfigIsSupported('audio', options.audio, AudioEncoder)])

      this.#audio = {
        config: options.audio,
        transform: new AudioEncoderTransform(options.audio, AudioEncoder),
        promise: undefined,
      }
      const audio = this.#audio

      let hasFirstChunk = false
      let firstTimetsamp = 0

      audio.promise = audio.transform.readable.pipeTo(
        new WritableStream({
          write: ([chunk, meta]) => {
            if (!hasFirstChunk) {
              hasFirstChunk = true
              firstTimetsamp = chunk.timestamp
            }

            const timestamp = chunk.timestamp - firstTimetsamp
            if (useAudioEncoderPolyfil) {
              const data = (chunk as EncodedAudioChunkPolyfill)._libavGetData()
              this.muxer.addAudioChunkRaw(data, chunk.type, timestamp, chunk.duration!, meta)
            } else this.muxer.addAudioChunk(chunk, meta, timestamp)
            this.onOutput?.('audio', chunk.timestamp)
          },
        }),
      )
    }

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: this.#video && {
        ...this.#video.config,
        codec: this.#video.config.codec.startsWith('avc') ? 'avc' : 'vp9',
      },
      audio: this.#audio?.config,
      fastStart: 'in-memory',
    })

    return this
  }

  async flush() {
    await Promise.all([this.#video?.promise, this.#audio?.promise])
  }

  finalize() {
    const { muxer } = this
    muxer.finalize()
    return muxer.target.buffer
  }
}
