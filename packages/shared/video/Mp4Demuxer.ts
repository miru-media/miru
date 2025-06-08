/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment  */

import * as MP4Box_ from 'mp4box'

import { promiseWithResolvers } from 'shared/utils'

import {
  type AudioMetadata,
  type DemuxerSampleCallback,
  type MediaChunk,
  type MediaContainerMetadata,
  type MP4BoxAudioTrack,
  type MP4BoxFileInfo,
  type MP4BoxSample,
  type MP4BoxTrack,
  type MP4BoxVideoTrack,
  type VideoMetadata,
} from './types'

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

const MP4Box = MP4Box_ as { createFile<S = unknown, E = unknown>(): MP4BoxFile<S, E>; DataStream: any }

interface TrackState {
  track: MP4BoxTrack
  isEnded: boolean
  sampleBytes: number
  presentationOffsetS: number
  onSample: (chunk: MediaChunk) => unknown
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
  #fileAbort = new AbortController()

  async init(url: string, requestInit?: RequestInit): Promise<MediaContainerMetadata> {
    requestInit?.signal?.addEventListener('abort', () => this.#fileAbort.abort(), { once: true })
    const response = await fetch(url, { ...requestInit, signal: this.#fileAbort.signal })

    if (!response.ok || !response.body) throw new Error(`Invalid response from "${url}".`)

    const contentType = response.headers.get('content-type')
    if (contentType && !/video\/(mp4|mov|quicktime)/.test(contentType))
      throw new Error(`Unexpected content-type: "${contentType}"`)

    this.#inputStream = response.body
    let fileOffset = 0

    return new Promise((resolve, reject) => {
      this.#file.onReady = (info: MP4BoxFileInfo) => resolve(this.getMetadata(info))

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

      this.#pipePromise.catch(reject)
    })
  }

  getMetadata(info: MP4BoxFileInfo): MediaContainerMetadata {
    const videoTrack = info.videoTracks[0] as MP4BoxVideoTrack | undefined
    const audioTrack = info.audioTracks[0] as MP4BoxAudioTrack | undefined

    const video = videoTrack && this.getTrackMetadata(videoTrack)
    const audio = audioTrack && this.getTrackMetadata(audioTrack)

    return {
      type: 'mp4',
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing
      duration: info.duration / info.timescale || video?.duration || audio?.duration || 0,
      video,
      audio,
    }
  }

  getTrackMetadata(track: MP4BoxVideoTrack): VideoMetadata
  getTrackMetadata(track: MP4BoxAudioTrack): AudioMetadata
  getTrackMetadata(track: MP4BoxVideoTrack | MP4BoxAudioTrack): VideoMetadata | AudioMetadata {
    const { codec } = track
    const trak = this.#file.getTrackById(track.id)
    // track.duration is zero in some files
    const duration = (track.duration || track.samples_duration) / track.timescale

    if (track.type === 'audio') {
      const { audio } = track
      const mp4aSampleDescription = trak.mdia.minf.stbl.stsd.entries.find(({ type }: any) => type === 'mp4a')

      return {
        id: track.id,
        type: track.type,
        codec,
        duration,
        sampleRate: audio.sample_rate,
        numberOfChannels: audio.channel_count,
        track,
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

    const matrix = Array.from(track.matrix).map(
      (n, i) => n / (i % 3 === 2 ? 2 ** 30 : 2 ** 16),
    ) as VideoMetadata['matrix']
    const rotation = Math.atan2(matrix[3], matrix[0]) * (180 / Math.PI)

    return {
      id: track.id,
      type: track.type,
      codec: codec.startsWith('vp08') ? 'vp8' : codec,
      duration,
      fps: track.nb_samples / (track.samples_duration / track.timescale),
      description,
      codedWidth: width,
      codedHeight: height,
      matrix,
      rotation,
      track,
    }
  }

  setExtractionOptions(
    track: MP4BoxVideoTrack | MP4BoxAudioTrack,
    onSample: DemuxerSampleCallback,
    onDone?: () => void,
  ) {
    this.#trackConfigs.push({ track, onSample, onDone })
  }

  async start(_firstFrameTimeS = 0, lastFrameTimeS?: number) {
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

          const chunk: MediaChunk = {
            data,
            type: is_sync ? ('key' as const) : ('delta' as const),
            timestamp: timeS * 1e6,
            duration: (duration * 1e6) / timescale,
            codedWidth,
            codedHeight,
            colorSpace,
            mediaType: track.type as 'audio' | 'video',
          }

          state.onSample(chunk)

          if (timeS >= lastFrameTimeS && is_sync) {
            state.isEnded = true
            break
          }
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

    await new Promise<void>((resolve, reject) => {
      this.#pipePromise?.catch(reject)
      this.#file.onError = reject
      this.#file.start()
      Promise.all(extractionPromises)
        .then(() => resolve())

        .catch(reject)
    }).finally(this.stop.bind(this))
  }

  stop() {
    this.#file.stop()
    this.#fileAbort.abort('stopped')
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
