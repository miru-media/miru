/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment  */

import * as MP4Box_ from 'mp4box'

import { promiseWithResolvers } from 'shared/utils'

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
    avcC?: {
      type: 'avcC'
      size: number
      hdr_size: number
      start: number
      configurationVersion: number
      AVCProfileIndication: number
      profile_compatibility: number
      AVCLevelIndication: number
      lengthSizeMinusOne: number
      nb_SPS_nalus: number
      SPS: {
        length: number
        nalu: Uint8Array
      }[]
      nb_PPS_nalus: 1
      PPS: {
        length: number
        nalu: Uint8Array
      }[]
    }
    colr?: {
      type: 'colr'
      size: number
      hdr_size: number
      start: number
      data: Uint8Array
      colour_type: string
      colour_primaries: number
      transfer_characteristics: number
      matrix_coefficients: number
      full_range_flag: number
    }
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

export interface DemuxerChunkInfo {
  type: 'key' | 'delta'
  timestamp: number
  duration: number
  data: ArrayBuffer
  colorSpace?: VideoColorSpaceInit
  codedWidth: number
  codedHeight: number
  mediaType: 'audio' | 'video'
}

export type DemuxerSampleCallback = (chunk: DemuxerChunkInfo) => void

interface TrackState {
  track: MP4BoxTrack
  isEnded: boolean
  sampleBytes: number
  presentationOffsetS: number
  onSample: (chunk: DemuxerChunkInfo) => unknown
  onDone?: () => void
  resolve: () => void
  reject: (reason: any) => void
}

export class MP4Demuxer {
  #file = MP4Box.createFile<unknown, TrackState>()
  #inputStream?: ReadableStream<Uint8Array>
  #pipePromise?: Promise<void>
  #trackConfigs: {
    track: MP4BoxVideoTrack | MP4BoxAudioTrack
    onSample: DemuxerSampleCallback
    onDone?: () => void
  }[] = []
  #promise?: Promise<void>
  #fileAbort = new AbortController()

  async init(url: string, requestInit?: RequestInit) {
    requestInit?.signal?.addEventListener('abort', () => this.#fileAbort.abort(), { once: true })
    const response = await fetch(url, { ...requestInit, signal: this.#fileAbort.signal })

    if (!response.ok || !response.body) throw new Error(`Invalid response from "${url}".`)

    const contentType = response.headers.get('content-type')
    if (contentType && !/video\/(mp4|mov|quicktime)/.test(contentType))
      throw new Error(`Unexpected content-type: "${contentType}"`)

    this.#inputStream = response.body
    let fileOffset = 0

    return new Promise<MP4BoxFileInfo>((resolve, reject) => {
      this.#file.onReady = (info: MP4BoxFileInfo) => resolve(info)
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

  getConfig(track: MP4BoxVideoTrack): VideoDecoderConfig & { codedWidth: number; codedHeight: number }
  getConfig(track: MP4BoxAudioTrack): AudioDecoderConfig
  getConfig(track: MP4BoxVideoTrack | MP4BoxAudioTrack): VideoDecoderConfig | AudioDecoderConfig {
    const { codec } = track
    const trak = this.#file.getTrackById(track.id)

    if (track.type === 'audio') {
      const { audio } = track
      const mp4aSampleDescription = trak.mdia.minf.stbl.stsd.entries.find(({ type }: any) => type === 'mp4a')

      return {
        codec,
        sampleRate: audio.sample_rate,
        numberOfChannels: audio.channel_count,
        ...(mp4aSampleDescription == null ? null : parseAudioStsd(mp4aSampleDescription)),
      }
    }

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
        description = new Uint8Array(stream.buffer, box.hdr_size)
        break
      }
    }

    if (!description) throw new Error('Unsupported format.')

    const { width, height } = track.video

    return {
      codec: codec.startsWith('vp08') ? 'vp8' : codec,
      description,
      codedWidth: width,
      codedHeight: height,
    }
  }

  setExtractionOptions(
    track: MP4BoxVideoTrack | MP4BoxAudioTrack,
    onSample: DemuxerSampleCallback,
    onDone?: () => void,
  ) {
    this.#trackConfigs.push({ track, onSample, onDone })
  }

  start(_firstFrameTimeS = 0, lastFrameTimeS?: number) {
    lastFrameTimeS ??= this.#trackConfigs.reduce(
      (acc, { track }) => Math.min(acc, track.samples_duration / track.timescale),
      Infinity,
    )
    const extractionPromises: Promise<void>[] = []

    this.#trackConfigs.forEach(({ track, onSample, onDone }) => {
      const { promise, resolve, reject } = promiseWithResolvers()
      extractionPromises.push(promise)

      this.#file.setExtractionOptions(track.id, {
        track,
        onSample: onSample as TrackState['onSample'],
        onDone,
        sampleBytes: 0,
        presentationOffsetS: getTrakEditTimeS(this.#file.getTrackById(track.id)),
        isEnded: false,
        resolve,
        reject,
      })
    })

    this.#file.onSamples = (track_id, state, samples) => {
      if (state.isEnded) return

      const samplesLength = samples.length
      const PRIMARIES = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<
        number,
        VideoColorSpaceInit['primaries']
      >
      const TRANFERS = { 1: 'bt709', 13: 'iec61966-2-1' } as Record<number, VideoColorSpaceInit['transfer']>
      const MATRICES = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<
        number,
        VideoColorSpaceInit['matrix']
      >

      try {
        for (let i = 0; i < samplesLength; i++) {
          const { data, is_sync, cts, duration, timescale, description } = samples[i]
          const timeS = cts / timescale - state.presentationOffsetS
          const { track } = state

          state.sampleBytes += data.byteLength

          let codedWidth = 0
          let codedHeight = 0
          let colorSpace: VideoColorSpaceInit | undefined

          if (track.type === 'video') {
            codedWidth = description.width
            codedHeight = description.height

            const { colr } = description
            colorSpace = colr && {
              primaries: PRIMARIES[colr.colour_primaries],
              transfer: TRANFERS[colr.transfer_characteristics],
              matrix: MATRICES[colr.matrix_coefficients],
            }
          }

          const chunkInfo: DemuxerChunkInfo = {
            data,
            type: is_sync ? ('key' as const) : ('delta' as const),
            timestamp: timeS * 1_000_000,
            duration: (duration * 1_000_000) / timescale,
            codedWidth,
            codedHeight,
            colorSpace,
            mediaType: track.type as 'audio' | 'video',
          }

          state.onSample(chunkInfo)

          state.isEnded ||= timeS >= lastFrameTimeS && is_sync
        }

        state.isEnded ||= state.sampleBytes >= this.#file.getTrackById(track_id).samples_size
      } catch (error) {
        state.isEnded = true
        state.reject(error)
        return
      }

      if (state.isEnded) {
        state.onDone?.()
        state.resolve()
        return
      }
    }

    this.#promise = new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
      this.#pipePromise?.catch(reject)
      this.#file.onError = reject
      this.#file.start()
      Promise.all(extractionPromises)
        .then(() => resolve())
        // eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
        .catch(reject)
    }).finally(this.stop.bind(this))
  }

  stop() {
    this.#file.stop()
    this.#fileAbort.abort('stopped')
  }

  flush() {
    return Promise.resolve(this.#promise)
  }
}

const getTrakEditTimeS = (trak: any) => {
  const edit = trak.edts?.elst.entries[0]
  if (edit == null) return 0

  return edit.media_time / trak.mdia.mdhd.timescale
}

const parseAudioStsd = (stsd: any) => {
  const decoderconfig = stsd.esds.esd.descs[0]?.descs[0]
  const data = decoderconfig.data as Uint8Array
  // [
  //   [5 bits: audioObjectType] [3 bits: samplingFrequencyIndex],
  //   [1 bit: sampleFrequencyIndex] [4 bits: channelConfiguration] [...],
  //   ...
  // ]
  const samplingFrequencyIndex = ((data[0] & 0b00000111) << 1) + (data[1] >> 7)
  const channelConfiguration = (data[1] & 0b01111000) >> 3

  const samplingFrequencyMap = [
    96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
  ]
  const sampleRate = samplingFrequencyMap[samplingFrequencyIndex]

  return { sampleRate, numberOfChannels: channelConfiguration }
}
