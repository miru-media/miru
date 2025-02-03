export const MOBILE_MAX_WIDTH = 640

export const MIN_CLIP_DURATION_S = 0.25
export const TRANSITION_DURATION_S = 0.5
export const MIN_CLIP_WIDTH_PX = 2

export const ACCEPT_VIDEO_FILE_TYPES = 'video/mp4,video/mov,video/quicktime,.mp4,.m4a,.mov,.quicktime,'

export const EXPORT_VIDEO_CODEC = `avc1.4200${(40).toString(16)}` as const

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
