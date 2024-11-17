/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment  */

import { promiseWithResolvers } from '@/utils'
import * as MP4Box_ from 'mp4box'

export interface MP4BoxFile<S = unknown, E = unknown> {
  onMoovStart(): void
  onReady(info: MP4BoxFileInfo): void
  onError(error: unknown): void
  appendBuffer(data: Uint8Array & { fileStart: number }): number
  start(): void
  stop(): void
  flush(): void
  setSegmentOptions(track_id: number, user?: S, options?: { nbSamples: number; rapAlignment: boolean }): void
  unsetSegmentOptions(track_id: number): void
  onSegment(id: number, user: S, buffer: ArrayBuffer, sampleNumber: number, last: boolean): void
  initializeSegmentation(): {
    id: 2
    buffer: ArrayBuffer
    user: S
    sampleNumber: number
    last?: boolean
  }
  setExtractionOptions(
    track_id: number,
    user?: E,
    options?: { nbSamples: number; rapAlignment: boolean },
  ): void
  unsetExtractionOptions(track_id: number): void
  onSamples(id: number, user: E, samples: MP4BoxSample[]): void
  seek(time: number, useRap?: boolean): { offset: number; time: number }
  releaseUsedSamples(id: number, sampleNumber: number): void
  getTrackById(track_id: number): any
}

export interface MP4BoxSample {
  data: ArrayBuffer
  moof_number: number
  number_in_traf: number
  number: number
  track_id: number
  timescale: number
  description_index: number
  size: number
  duration: number
  dts: number
  cts: number
  is_sync: boolean
  is_leading: number
  depends_on: number
  is_depended_on: number
  has_redundancy: number
  degradation_priority: number
  offset: number
  alreadyRead: number
  description: {
    type: string
    size: number
    boxes: unknown[]
    hdr_size: number
    start: number
    data_reference_index: number
    width: number
    height: number
    horizresolution: number
    vertresolution: number
    frame_count: number
    compressorname: string
    depth: number
    avcC: unknown
  }
}

export interface MP4BoxBaseTrack {
  id: number
  name: string
  references: unknown[]
  created: string
  modified: string
  movie_duration: number
  movie_timescale: number
  layer: number
  alternate_group: number
  volume: number
  matrix: Int32Array
  track_width: number
  track_height: number
  timescale: number
  cts_shift?: number
  duration: number
  samples_duration: number
  codec: string
  kind: {
    schemeURI: string
    value: string
  }
  language: string
  nb_samples: number
  size: number
  bitrate: number
  type: string
}

export interface MP4BoxVideoTrack extends MP4BoxBaseTrack {
  video: {
    width: number
    height: number
  }
  type: 'video'
}

export interface MP4BoxAudioTrack extends MP4BoxBaseTrack {
  audio: {
    sample_rate: number
    channel_count: number
    sample_size: number
  }
  type: 'audio'
}

export type MP4BoxTrack = MP4BoxVideoTrack | MP4BoxAudioTrack | MP4BoxBaseTrack

export interface MP4BoxFileInfo {
  duration: number
  timescale: number
  isFragmented: boolean
  isProgressive: boolean
  hasIOD: boolean
  brands: string[]
  created: string
  modified: string
  tracks: MP4BoxTrack[]
  videoTracks: MP4BoxVideoTrack[]
  audioTracks: MP4BoxAudioTrack[]
}

const MP4Box = MP4Box_ as { createFile<S = unknown, E = unknown>(): MP4BoxFile<S, E>; DataStream: any }

export interface DemuxerConfig {
  info: MP4BoxFileInfo
  file: MP4BoxFile
}

export interface DemuxerChunkInfo {
  type: 'key' | 'delta'
  timestamp: number
  duration: number
  data: ArrayBuffer
}

export type VideoSampleCallback = (chunk: EncodedVideoChunk) => void
export type AudioSampleCallback = (chunk: DemuxerChunkInfo) => void

interface TrackState {
  track: MP4BoxTrack
  isEnded: boolean
  sampleBytes: number
  callback: (chunk: EncodedVideoChunk | DemuxerChunkInfo) => unknown
  resolve: () => void
  reject: (reason: any) => void
}

export class MP4Demuxer {
  #file = MP4Box.createFile<unknown, TrackState>()
  #inputStream?: ReadableStream<Uint8Array>
  #pipePromise?: Promise<void>

  async init(url: string) {
    const response = await fetch(url)

    if (!response.ok || !response.body) throw new Error(`Invalid response from "${url}".`)

    const contentType = response.headers.get('content-type')
    if (contentType && !/video\/(mp4|mpeg|mov|quicktime)/.test(contentType))
      throw new Error(`Unexpected content-type: "${contentType}"`)

    this.#inputStream = response.body
    let fileOffset = 0

    return new Promise<DemuxerConfig>((resolve, reject) => {
      this.#file.onReady = (info: MP4BoxFileInfo) => resolve({ info, file: this.#file })
      this.#file.onError = reject

      this.#pipePromise = this.#inputStream!.pipeTo(
        new WritableStream(
          {
            write: (chunk) => {
              const buffer = chunk.buffer as Uint8Array & { fileStart: number }
              buffer.fileStart = fileOffset
              fileOffset += buffer.byteLength
              this.#file.appendBuffer(buffer)
            },
          },
          { highWaterMark: 1 },
        ),
      )

      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
      this.#pipePromise.catch(reject)
    })
  }

  getConfig<T extends MP4BoxTrack>(
    track: T,
  ): T extends MP4BoxVideoTrack ? VideoDecoderConfig : { codec: string; description: Uint8Array } {
    const trak = this.#file.getTrackById(track.id)
    let description

    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      const box =
        entry.avcC ?? // H.264
        entry.hvcC ?? // H.265
        entry.vpcC ?? // VPX
        entry.av1C ?? // AV1
        null

      if (box != null) {
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN)
        box.write(stream)
        const BOX_HEADER_LENGTH = 8
        description = new Uint8Array(stream.buffer, BOX_HEADER_LENGTH)
        break
      }
    }

    if (!description) throw new Error('Unsupported format.')

    const { codec } = track

    return {
      codec: codec.startsWith('vp08') ? 'vp8' : codec,
      description,
      ...('video' in track ? track.video : undefined),
    }
  }

  async start(
    trackConfigs: (
      | { track: MP4BoxVideoTrack; callback: VideoSampleCallback }
      | { track: MP4BoxAudioTrack; callback: AudioSampleCallback }
    )[],
    _startTime = 0,
    endTime = trackConfigs.reduce(
      (acc, { track }) => Math.min(acc, track.duration / track.timescale),
      Infinity,
    ),
  ) {
    const extractionPromises: Promise<void>[] = []

    trackConfigs.forEach(({ track, callback }) => {
      const { promise, resolve, reject } = promiseWithResolvers()
      extractionPromises.push(promise)

      this.#file.setExtractionOptions(track.id, {
        track,
        callback: callback as TrackState['callback'],
        sampleBytes: 0,
        isEnded: false,
        resolve,
        reject,
      })
    })

    this.#file.onSamples = (track_id, state, samples) => {
      if (state.isEnded) return

      const samplesLength = samples.length

      try {
        for (let i = 0; i < samplesLength; i++) {
          const { data, is_sync, cts, duration, timescale } = samples[i]
          const timeS = cts / timescale

          state.sampleBytes += data.byteLength

          state.isEnded = timeS >= endTime
          if (state.isEnded) break

          const chunkInfo: DemuxerChunkInfo = {
            data,
            type: is_sync ? ('key' as const) : ('delta' as const),
            timestamp: timeS * 1_000_000,
            duration: (duration * 1_000_000) / timescale,
          }

          const { track } = state
          state.callback(track.type === 'video' ? new EncodedVideoChunk(chunkInfo) : chunkInfo)
        }

        const trak = this.#file.getTrackById(track_id)
        state.isEnded ||= state.sampleBytes >= trak.samples_size
      } catch (error) {
        state.isEnded = true
        state.reject(error)
        return
      }

      if (state.isEnded) {
        state.resolve()
        return
      }
    }

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
      this.#pipePromise?.catch(reject)
      this.#file.onError = reject
      this.#file.start()
      Promise.all(extractionPromises)
        .then(() => resolve())
        // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
        .catch(reject)
    })

    this.stop()
  }

  stop() {
    this.#file.stop()
    this.#inputStream?.cancel().catch(() => undefined)
  }
}
