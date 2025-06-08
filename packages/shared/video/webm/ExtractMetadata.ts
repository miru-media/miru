import type * as ebml from 'ebml'
import ebmlBlock from 'ebml-block'

import {
  type AudioMetadata,
  type EbmlChunk,
  type MediaContainerMetadata,
  type VideoMetadata,
  type WebmTrack,
} from '../types'

export class MetadataExtractor extends TransformStream<EbmlChunk, MediaContainerMetadata> {
  #segmentTimescale = 1000000
  #segmentDurationTicks = 0
  #hasTracksAndInfo = false
  #missingVideoCodecParams = false
  #missingVideoFrameRate = false
  #missingDuration = false
  #completedTags = new Set<string>()
  #metadata: MediaContainerMetadata = {
    type: 'webm',
    duration: 0,
    video: undefined,
    audio: undefined,
  }
  #isDone = false

  #writeIfComplete(controller: TransformStreamDefaultController<MediaContainerMetadata>) {
    if (
      !this.#hasTracksAndInfo ||
      this.#missingVideoCodecParams ||
      this.#missingVideoFrameRate ||
      this.#missingDuration
    )
      return

    this.#isDone = true
    controller.enqueue(this.#metadata)
    controller.terminate()
  }

  constructor() {
    let currentTrack: WebmTrack | undefined
    const tracksById: Record<string, VideoMetadata | AudioMetadata | undefined> = {}

    let currentClusterTimecodeTicks = 0

    super({
      transform: (chunk, controller) => {
        if (this.#isDone) return

        const type = chunk[0]
        const data = chunk[1]

        if (type === 'end') {
          this.#completedTags.add(data.name)

          if (data.name === 'Info') {
            const duration = (this.#segmentDurationTicks * 1e3) / this.#segmentTimescale
            this.#metadata.duration = duration
            this.#missingDuration = !duration
          }
        }

        if (this.#hasTracksAndInfo) {
          switch (data.name) {
            case 'Timestamp':
              currentClusterTimecodeTicks = (data as ebml.Tag<'u'>).value
              break
            case 'SimpleBlock': {
              const simpleBlock = data as ebml.SimpleBlock
              const track = tracksById[simpleBlock.track]
              if (!track) break

              const { frames, invisible, timecode } = ebmlBlock(simpleBlock.data)

              if (this.#missingVideoCodecParams && simpleBlock.keyframe && track.codec === 'vp09') {
                const frame = frames[0]
                const profileBits = (frame[0] >>> 4) & 0b11
                const profile = ((profileBits >>> 1) & 1) | ((profileBits << 1) & 0b10)
                const level = 10 // TODO
                const bitDepth = profile >= 2 ? (frame[4] & 0b10000000 ? 12 : 10) : 8

                track.codec = `vp09.${[profile, level, bitDepth].map((v) => v.toString(10).padStart(2, '0')).join('.')}`

                this.#missingVideoCodecParams = false
                this.#writeIfComplete(controller)
              }

              if (this.#missingVideoFrameRate && track.type === 'video') {
                const timestampTicks = timecode

                if (timestampTicks !== 0 && !invisible) {
                  track.fps = 1e9 / (timestampTicks * this.#segmentTimescale)
                  this.#missingVideoFrameRate = false
                  this.#writeIfComplete(controller)
                }
              }

              if (this.#missingDuration) {
                const timestampS = ((timecode + currentClusterTimecodeTicks) * this.#segmentTimescale) / 1e9
                const defaultDurationS = (track.track as WebmTrack).DefaultDuration / 1e9
                const frameDurationS =
                  defaultDurationS || (track.type === 'video' && track.fps ? 1 / track.fps : 0)

                this.#metadata.duration = Math.max(this.#metadata.duration, timestampS + frameDurationS)
              }
            }
          }

          return
        }

        if (data.name === 'TrackEntry') {
          if (type === 'start') {
            currentTrack = {
              TrackNumber: 0,
              TrackType: 0,
              CodecID: '',
              TrackTimestampScale: 1,
              DefaultDuration: 0,
              PixelWidth: 0,
              PixelHeight: 0,
              SamplingFrequency: 0,
              Channels: 0,
              CodecDelay: 0,
              CodecPrivate: undefined,

              TimestampScale: this.#segmentTimescale,
              Duration: this.#segmentDurationTicks,
            }
          } else if (currentTrack) {
            const { TrackType } = currentTrack

            if (TrackType === 1 || TrackType === 2) {
              const trackMetadata = this.#getTrackMetadata(currentTrack)

              if (trackMetadata) {
                if (trackMetadata.type === 'video') this.#metadata.video = trackMetadata
                else this.#metadata.audio = trackMetadata

                tracksById[trackMetadata.id] = trackMetadata
              } else currentTrack = undefined
            }

            currentTrack = undefined
          }
        }

        if (type === 'tag') {
          const data = chunk[1]
          switch (data.name) {
            case 'TimestampScale':
              this.#segmentTimescale = data.value as number
              break
            case 'Duration':
              this.#segmentDurationTicks = data.value as number
              break

            case 'TrackNumber':
            case 'PixelWidth':
            case 'TrackType':
            case 'PixelHeight':
            case 'TrackTimestampScale':
            case 'DefaultDuration':
            case 'SamplingFrequency':
            case 'Channels':
            case 'CodecDelay':
              currentTrack![data.name] = (data as ebml.Tag<'u'>).value
              break
            case 'CodecID':
              currentTrack!.CodecID = (data as ebml.Tag<'s'>).value.replace('\u0000', '')
              break
            case 'CodecPrivate':
              currentTrack!.CodecPrivate = data.data
          }
        }

        this.#hasTracksAndInfo ||= this.#completedTags.has('Tracks') && this.#completedTags.has('Info')

        this.#writeIfComplete(controller)
      },
      flush: (conttroller) => {
        if (!this.#isDone) conttroller.enqueue(this.#metadata)
      },
    })
  }

  #getTrackMetadata(track: WebmTrack): VideoMetadata | AudioMetadata | undefined {
    const codecs = [
      ['A_OPUS', 'opus'],
      ['A_VORBIS', 'vorbis'],

      ['V_VP8', 'vp8'],
      ['V_VP9', 'vp09'],
      ['V_AV1', 'av01'],
      ['V_MPEG4/ISO/AVC', 'avc1'],
      ['V_MPEGH/ISO/HEVC', 'hev1'],
    ] as const
    const { CodecID, TrackType } = track
    if (TrackType !== 1 && TrackType !== 2) return

    let codec = codecs.find((c) => CodecID.startsWith(c[0]))?.[1] as string
    const description = track.CodecPrivate

    if (!codec) throw new Error(`Unsupported Matroska codec "${CodecID}".`)

    switch (codec) {
      case 'vp09': {
        if (description && description.length >= 6) {
          // assume single-byte profile, level, bit depth features
          const features = [description[2], description[5], description[8]]
          codec = `vp09.${features.map((v) => v.toString(10).padStart(2, '0')).join('.')}`
        } else this.#missingVideoCodecParams = true

        break
      }
      case 'avc1': {
        if (!description) break
        const [profile, compatibility, level] = Array.from(description.slice(1, 3)).map((v) => v.toString(16))
        codec = `${codec}.${profile}${compatibility}${level}`
        break
      }
    }

    const type = track.TrackType === 1 ? 'video' : 'audio'
    const fps = track.DefaultDuration ? 1e9 / track.DefaultDuration : 0
    this.#missingVideoFrameRate = type === 'video' && !fps

    return {
      type,
      id: track.TrackNumber,
      codec,
      duration: (track.Duration * track.TrackTimestampScale * track.TimestampScale) / 1e9,
      fps,
      codedWidth: track.PixelWidth,
      codedHeight: track.PixelHeight,
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      rotation: 0,
      numberOfChannels: track.Channels,
      sampleRate: track.SamplingFrequency,
      codecDelay: (track.CodecDelay * this.#segmentTimescale) / 1e9,
      description,
      track,
    }
  }
}
