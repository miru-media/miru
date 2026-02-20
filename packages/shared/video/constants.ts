export const EXPORT_VIDEO_CODECS_AVC = ['avc1.420028', 'avc1.640028'] as const
export const EXPORT_VIDEO_CODECS_VP9 = ['vp09.00.41.08'] as const
export const EXPORT_VIDEO_CODECS = [...EXPORT_VIDEO_CODECS_AVC, ...EXPORT_VIDEO_CODECS_VP9] as const

export const ReadyState = {
  HAVE_NOTHING: 0,
  HAVE_METADATA: 1,
  HAVE_CURRENT_DATA: 2,
  HAVE_ENOUGH_DATA: 3,
  HAVE_FUTURE_DATA: 4,
} as const
export type ReadyState = (typeof ReadyState)[keyof typeof ReadyState]
