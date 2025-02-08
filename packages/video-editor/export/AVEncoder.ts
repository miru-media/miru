import { ArrayBufferTarget, Muxer } from 'mp4-muxer'

import { assertEncoderConfigIsSupported } from 'shared/transcode/utils'
import { win } from 'shared/utils'

import { type EncodedAudioChunk as EncodedAudioChunkPolyfill } from './polyfill'

export namespace AVEncoder {
  export interface VideoOptions {
    config?: VideoEncoderConfig
    width: number
    height: number
    fps: number
  }

  export interface AudioOptions {
    config?: Omit<AudioEncoderConfig, 'codec'> & { codec: 'opus' | 'aac' }
  }
}

export class AVEncoder {
  video?: Required<AVEncoder.VideoOptions> & {
    config: VideoEncoderConfig
    encoder?: VideoEncoder
  }
  audio?: Required<AVEncoder.AudioOptions> & {
    encoder?: AudioEncoder
  }
  muxer: Muxer<ArrayBufferTarget>
  onOutput?: (type: 'audio' | 'video', timestamp: number) => void
  onError: (error: unknown) => void
  firstVideoFrameTimeUs?: number

  AudioEncoder = win.AudioEncoder
  AudioData = win.AudioData

  constructor(options: {
    video?: AVEncoder.VideoOptions
    audio?: AVEncoder.AudioOptions
    onOutput?: (type: 'audio' | 'video', timestamp: number) => void
    onError: (error: unknown) => void
  }) {
    const { video, audio } = options

    this.onOutput = options.onOutput
    this.onError = options.onError

    if (video) {
      const { width, height, fps } = video
      const { codec = `avc1.4200${(40).toString(16)}`, bitrate = 1e7 } = video.config ?? {}

      this.video = {
        ...video,
        config: { codec, width, height, bitrate, framerate: fps },
      }
    }

    if (audio) {
      this.audio = {
        config: { codec: 'opus', numberOfChannels: 2, sampleRate: 48000 },
        ...audio,
      }
    }

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: video && {
        codec: 'avc',
        width: video.width,
        height: video.height,
      },
      audio: this.audio?.config,
      fastStart: 'in-memory',
    })
  }

  async init() {
    const { audio, video } = this

    if (video) {
      await assertEncoderConfigIsSupported('video', video.config)
      video.encoder = new VideoEncoder({
        output: (chunk, meta) => {
          if (this.firstVideoFrameTimeUs === undefined) this.firstVideoFrameTimeUs = chunk.timestamp
          this.muxer.addVideoChunk(chunk, meta, chunk.timestamp - this.firstVideoFrameTimeUs)
          this.onOutput?.('video', chunk.timestamp)
        },
        error: this.onError,
      })
      video.encoder.configure(video.config)
    }

    if (audio) {
      const isPolyfill = (this.AudioEncoder as unknown) == null || (this.AudioData as unknown) == null

      if (isPolyfill) {
        const polyfill = await import('./polyfill')
        await polyfill.init()

        this.AudioEncoder = polyfill.AudioEncoder as typeof AudioEncoder
        this.AudioData = polyfill.AudioData
      }

      await Promise.all([assertEncoderConfigIsSupported('audio', audio.config, this.AudioEncoder)])

      let hasFirstChunk = false
      let firstTimetsamp = 0

      audio.encoder = new this.AudioEncoder({
        output: (chunk, meta) => {
          if (!hasFirstChunk) {
            hasFirstChunk = true
            firstTimetsamp = chunk.timestamp
          }

          const timestamp = chunk.timestamp - firstTimetsamp
          if (isPolyfill) {
            const data = (chunk as EncodedAudioChunkPolyfill)._libavGetData()
            this.muxer.addAudioChunkRaw(data, chunk.type, timestamp, chunk.duration!, meta)
          } else this.muxer.addAudioChunk(chunk, meta, timestamp)
          this.onOutput?.('audio', chunk.timestamp)
        },
        error: this.onError,
      })
      audio.encoder.configure(audio.config)
    }
    return this
  }

  encodeVideoFrame(frame: VideoFrame, options?: VideoEncoderEncodeOptions) {
    this.video!.encoder!.encode(frame, options)
  }

  encodeAudioData(data: AudioData) {
    this.audio!.encoder!.encode(data)
  }

  async whenReadyForVideo() {
    const encoder = this.video?.encoder
    if (!encoder) throw new Error('VideoEncoder is not initialized')

    if (encoder.encodeQueueSize >= 20)
      await new Promise((resolve) => encoder.addEventListener('dequeue', resolve, { once: true }))
  }

  async flush() {
    await Promise.all(
      [this.video, this.audio].map((type) => type?.encoder?.state === 'configured' && type.encoder.flush()),
    )
  }

  finalize() {
    const { muxer } = this
    muxer.finalize()
    return muxer.target.buffer
  }

  dispose() {
    ;[this.video, this.audio].forEach((type) => type?.encoder?.state === 'configured' && type.encoder.close())
  }
}
