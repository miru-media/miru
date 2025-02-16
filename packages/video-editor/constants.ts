export const MOBILE_MAX_WIDTH = 640

export const MIN_CLIP_DURATION_S = 0.25
export const TRANSITION_DURATION_S = 0.5
export const MIN_CLIP_WIDTH_PX = 2

export const ACCEPT_VIDEO_FILE_TYPES = 'video/mp4,video/mov,video/quicktime,.mp4,.m4a,.mov,.quicktime,'
export const ACCEPT_AUDIO_FILE_TYPES = `audio/*,.mp3,.m4a,.flac,.ogg,.webm,${ACCEPT_VIDEO_FILE_TYPES}`

const EXPORT_VIDEO_CODEC_AVC = `avc1.420028`
const EXPORT_VIDEO_CODEC_VP9 = 'vp09.00.41.08'
export const EXPORT_VIDEO_CODECS = [EXPORT_VIDEO_CODEC_AVC, EXPORT_VIDEO_CODEC_VP9]

export enum SourceNodeState {
  waiting = 0,
  sequenced = 1,
  playing = 2,
  paused = 3,
  ended = 4,
  error = 5,
}

export enum ReadyState {
  HAVE_NOTHING = 0,
  HAVE_METADATA = 1,
  HAVE_CURRENT_DATA = 2,
  HAVE_ENOUGH_DATA = 3,
  HAVE_FUTURE_DATA = 4,
}

export const VIDEO_PRESEEK_TIME_S = 2
export const MEDIA_SYNC_INTERVAL_MS = 500
export const MEDIA_SYNC_TOLERANCE_S = 0.3

export const ASSET_URL_REFRESH_TIMEOUT_MS = 3000
