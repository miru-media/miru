/* eslint-disable @typescript-eslint/no-unsafe-assignment  */
import * as MP4Box from 'mp4box'

import { FileSignature } from '../file-signature'
import {
  type AudioMetadata,
  type EncodedMediaChunk,
  type MediaContainerMetadata,
  type MP4BoxAudioTrack,
  type MP4BoxVideoTrack,
  type VideoMetadata,
} from '../types'

const PRIMARIES = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<
  number,
  VideoColorSpaceInit['primaries']
>
const TRANFERS = { 1: 'bt709', 13: 'iec61966-2-1' } as Record<number, VideoColorSpaceInit['transfer']>
const MATRICES = { 1: 'bt709', 5: 'bt470bg', 6: 'smpte170m' } as Record<number, VideoColorSpaceInit['matrix']>

interface TrackState {
  track: VideoMetadata | AudioMetadata
  isEnded: boolean
  sampleBytes: number
  extractedSampleCount: number
  firstFrameTimeUs: number
  lastFrameTimeUs: number
  presentationOffsetS: number
  transform: TransformStream<[number, TrackState, EncodedMediaChunk], EncodedMediaChunk>
}

export class MP4Demuxer {
  static signature = new FileSignature(
    4,
    new Uint8Array([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
    new Uint8Array([0x66, 0x74, 0x79, 0x70, 0x4d, 0x53, 0x4e, 0x56]),
    new Uint8Array([0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34]),
    new Uint8Array([0x66, 0x74, 0x79, 0x70, 0x71, 0x74]),
    new Uint8Array([
      0x66, 0x74, 0x79, 0x70, 0x64, 0x61, 0x73, 0x68, 0x00, 0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x36, 0x6d,
      0x70, 0x34,
    ]),
  )

  #fileOffset = 0
  #pendingFileChunks: Uint8Array[] = []
  #file = MP4Box.createFile(false) as MP4Box.ISOFile<unknown, TrackState>
  #samplesStream?: ReadableStream<Uint8Array>
  #chunkTransform!: TransformStream<Uint8Array, [number, TrackState, EncodedMediaChunk]>
  #abort = new AbortController()
  #trackStates: TrackState[] = []
  #onError!: ((error: Error) => void) | null

  async init(source: ReadableStream<Uint8Array>): Promise<MediaContainerMetadata> {
    this.#fileOffset = 0

    this.#file.onError = (module, msg) => {
      this.#onError?.(new Error(`${module}: ${msg}`))
    }

    this.#file.onReady = (info) => (metadata = this.getMetadata(info))
    let metadata: MediaContainerMetadata | undefined

    const [metadataStream, samplesStream] = source.tee()

    try {
      let error: unknown
      this.#onError = (e) => (error = e)

      const reader = metadataStream.getReader()
      const { signal } = this.#abort

      while (!metadata && error == undefined && !signal.aborted) {
        const { value, done } = await reader.read()
        if (value) this.#appendFileChunk(value)
        if (done) break
      }

      reader.releaseLock()
      void metadataStream.cancel()

      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (error != undefined) throw error
      if (!metadata) throw new Error(`Couldn't find MP4 container metadata.`)
    } catch (error) {
      void samplesStream.cancel()
      throw error
    }

    this.#samplesStream = samplesStream

    return metadata
  }

  #appendFileChunk(chunk: Uint8Array) {
    const buffer = chunk.buffer as MP4Box.MP4BoxBuffer
    buffer.fileStart = this.#fileOffset

    this.#file.appendBuffer(buffer)
    this.#fileOffset += buffer.byteLength
    this.#pendingFileChunks.length = 0
  }

  getMetadata(info: MP4Box.Movie): MediaContainerMetadata {
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
    let { codec } = track
    const trak = this.#file.getTrackById(track.id)
    // track.duration is zero in some files
    const duration = (track.duration || track.samples_duration) / track.timescale
    const fps = track.nb_samples / duration

    if (track.type === 'audio') {
      const { audio } = track
      const mp4aSampleDescription = trak.mdia.minf.stbl.stsd.entries.find(({ type }: any) => type === 'mp4a')

      if (codec === 'mp4a') codec = 'mp4a.40.2'

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

    for (const entry of trak.mdia.minf.stbl.stsd.entries as MP4Box.VisualSampleEntry[]) {
      const box =
        entry.avcC ?? // H.264
        entry.hvcC ?? // H.265
        entry.vpcC ?? // VPX
        entry.av1C ?? // AV1
        null

      if (box != null) {
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.Endianness.BIG_ENDIAN)
        box.write(stream as MP4Box.MultiBufferStream)
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
      fps,
      description,
      codedWidth: width,
      codedHeight: height,
      matrix,
      rotation,
      track,
    }
  }

  getChunkStream(track: VideoMetadata | AudioMetadata, firstFrameTimeS = 0, lastFrameTimeS = Infinity) {
    const lastFrameTimeUs = lastFrameTimeS * 1e6

    const state: TrackState = {
      track,
      sampleBytes: 0,
      extractedSampleCount: 0,
      firstFrameTimeUs: firstFrameTimeS * 1e6,
      lastFrameTimeUs,
      presentationOffsetS: getTrakEditTimeS(this.#file.getTrackById(track.id)),
      transform: new TransformStream({
        transform: (
          [trackId, , encodedChunk],
          controller: TransformStreamDefaultController<EncodedMediaChunk>,
        ) => {
          // filter to only chunks of the specified track
          if (trackId !== track.id) return

          controller.enqueue(encodedChunk)

          if (
            encodedChunk.timestamp + (encodedChunk.duration ?? 0) >= lastFrameTimeUs &&
            encodedChunk.type === 'key'
          ) {
            controller.terminate()
          }
        },
      }),
      isEnded: false,
    }

    this.#trackStates.push(state)
    this.#file.setExtractionOptions(track.id, state)

    return state.transform.readable
  }

  start() {
    this.#fileOffset = 0
    this.#chunkTransform = new TransformStream<Uint8Array, [number, TrackState, EncodedMediaChunk]>({
      start: (controller) => {
        this.#onError = controller.error.bind(controller)

        this.#file.onSamples = (track_id, state, samples) => {
          if (state.isEnded) return

          const { lastFrameTimeUs } = state

          try {
            const samplesLength = samples.length
            for (let i = 0; i < samplesLength; i++) {
              const sample = samples[i]
              const encodedChunk = sampleToEncodedChunk(state, sample)

              controller.enqueue([track_id, state, encodedChunk])

              if (encodedChunk.timestamp >= lastFrameTimeUs && sample.is_sync) {
                state.isEnded = true
                break
              }
            }

            state.extractedSampleCount += samplesLength
            this.#file.releaseUsedSamples(track_id, state.extractedSampleCount)

            if (state.isEnded) {
              this.#file.unsetExtractionOptions(track_id)
              controller.terminate()
            }
          } catch (error) {
            state.isEnded = true
            controller.error(error)
          }
        }
      },
      transform: this.#appendFileChunk.bind(this),
      flush: this.#file.flush.bind(this.#file),
    })

    this.#file.start()

    const encodedChunkStream = this.#samplesStream!.pipeThrough(this.#chunkTransform, {
      signal: this.#abort.signal,
    })

    let _chunkStream = encodedChunkStream

    this.#trackStates.forEach((trackState, i, states) => {
      let streamForTrack = _chunkStream
      if (i < states.length - 1) [streamForTrack, _chunkStream] = _chunkStream.tee()

      streamForTrack.pipeThrough(trackState.transform)
    })
  }

  stop() {
    this.#file.stop()
    this.#samplesStream?.cancel().catch(() => undefined)
    this.#abort.abort('stopped')
    this.#file.onError = this.#file.onReady = this.#file.onSamples = null
  }
}

const getTrakEditTimeS = (trak: any) => {
  const edit = trak.edts?.elst.entries[0]
  if (edit == null) return 0

  return edit.media_time / trak.mdia.mdhd.timescale
}

const parseAudioStsd = (stsd: any) => {
  const decoderconfig: { data?: Uint8Array } | undefined = stsd.esds?.esd.descs[0]?.descs[0]
  const data = decoderconfig?.data

  if (!data) return { sampleRate: stsd.samplerate, numberOfChannels: stsd.channel_count }

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

const sampleToEncodedChunk = (state: TrackState, sample: MP4Box.Sample) => {
  const { data, is_sync, cts, duration, timescale } = sample
  const timeS = cts / timescale - state.presentationOffsetS
  const { track } = state

  state.sampleBytes += data!.byteLength

  let codedWidth = 0
  let codedHeight = 0
  let colorSpace: VideoColorSpaceInit | undefined

  if (track.type === 'video') {
    const description = sample.description as MP4Box.VisualSampleEntry & {
      colr?: MP4Box.Box & {
        type: 'colr'
        colour_type: string
        colour_primaries: number
        transfer_characteristics: number
        matrix_coefficients: number
      }
    }
    ;({ width: codedWidth, height: codedHeight } = description)

    const { colr } = description
    colorSpace = colr && {
      primaries: PRIMARIES[colr.colour_primaries],
      transfer: TRANFERS[colr.transfer_characteristics],
      matrix: MATRICES[colr.matrix_coefficients],
    }
  }

  const chunk: EncodedMediaChunk = {
    data: data!,
    type: is_sync ? ('key' as const) : ('delta' as const),
    timestamp: timeS * 1e6,
    duration: (duration * 1e6) / timescale,
    codedWidth,
    codedHeight,
    colorSpace,
    mediaType: track.type,
  }

  return chunk
}
