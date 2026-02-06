import { IS_FIREFOX } from 'shared/userAgent.ts'

export * from './public-constants.ts'

export const MOBILE_MAX_WIDTH = 640

export const MIN_CLIP_DURATION_S = 0.25
export const TRANSITION_DURATION_S = 0.5
export const MIN_CLIP_WIDTH_PX = 2

export const SourceNodeState = {
  waiting: 0,
  sequenced: 1,
  playing: 2,
  paused: 3,
  ended: 4,
  error: 5,
} as const
export type SourceNodeState = (typeof SourceNodeState)[keyof typeof SourceNodeState]

export const VIDEO_PRESEEK_TIME_S = 2
export const MEDIA_SYNC_INTERVAL_MS = 500
export const MEDIA_SYNC_TOLERANCE_S = 0.3

export const ASSET_URL_REFRESH_TIMEOUT_MS = 3000

export const VIDEO_DECODER_HW_ACCEL_PREF = IS_FIREFOX ? 'prefer-software' : 'no-preference'

export const DEFAULT_FRAMERATE = 24
export const DEFAULT_RESOLUTION = { width: 1920, height: 1080 }
export const ASSET_TYPE_PREFIX = 'asset:'

export const ROOT_NODE_ID = '__ROOT_NODE__'
