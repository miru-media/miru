import type * as ebml from 'ebml'
import type * as MP4Box from 'mp4box'

export interface MP4BoxVideoTrack extends MP4Box.Track {
  video: {
    width: number
    height: number
  }
  type: 'video'
}

export interface MP4BoxAudioTrack extends MP4Box.Track {
  audio: {
    sample_rate: number
    channel_count: number
    sample_size: number
  }
  type: 'audio'
}

export type MP4BoxTrack = MP4BoxVideoTrack | MP4BoxAudioTrack | MP4Box.Track

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

export interface EncodedMediaChunk {
  type: 'key' | 'delta'
  timestamp: number
  duration?: number
  data: ArrayBuffer
  colorSpace?: VideoColorSpaceInit
  codedWidth: number
  codedHeight: number
  mediaType: 'audio' | 'video'
}

export type EbmlChunk<T extends ebml.TagType = any> =
  | ['start' | 'end', ebml.TagMetadata]
  | ['tag', ebml.Tag<T>]
