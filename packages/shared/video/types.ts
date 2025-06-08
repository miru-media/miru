import type * as ebml from 'ebml'

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

export interface MediaContainerMetadata {
  duration: number
  video?: VideoMetadata
  audio?: AudioMetadata
  type: 'mp4' | 'webm'
}

export interface WebmTrack {
  CodecID: string
  TrackNumber: number
  TrackType: number
  DefaultDuration: number
  PixelWidth: number
  PixelHeight: number
  TrackTimestampScale: number
  SamplingFrequency: number
  Channels: number
  CodecDelay: number
  CodecPrivate?: Uint8Array

  // from segment
  TimestampScale: number
  Duration: number
}

export interface VideoMetadata extends VideoDecoderConfig {
  id: number
  type: 'video'
  duration: number
  fps: number
  codedWidth: number
  codedHeight: number
  matrix: [number, number, number, number, number, number, number, number, number]
  rotation: number
  track: MP4BoxVideoTrack | WebmTrack
}
export interface AudioMetadata extends AudioDecoderConfig {
  id: number
  type: 'audio'
  duration: number
  codecDelay?: number
  numberOfChannels: number
  sampleRate: number
  track: MP4BoxAudioTrack | WebmTrack
}

export interface MediaChunk {
  type: 'key' | 'delta'
  timestamp: number
  duration?: number
  data: ArrayBuffer
  colorSpace?: VideoColorSpaceInit
  codedWidth: number
  codedHeight: number
  mediaType: 'audio' | 'video'
}

export type DemuxerSampleCallback = (chunk: MediaChunk) => void

export type EbmlChunk<T extends ebml.TagType = any> =
  | ['start' | 'end', ebml.TagMetadata]
  | ['tag', ebml.Tag<T>]
