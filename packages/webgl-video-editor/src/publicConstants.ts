export const ACCEPT_VIDEO_FILE_TYPES =
  'video/webm,video/matroska,video/x-matroska,video/mp4,video/mov,video/quicktime,.mp4,.m4a,.mov,.quicktime,'
export const ACCEPT_AUDIO_FILE_TYPES = `audio/*,.mp3,.m4a,.flac,.ogg,.webm,${ACCEPT_VIDEO_FILE_TYPES}`

const EXPORT_VIDEO_CODEC_AVC = `avc1.420028`
const EXPORT_VIDEO_CODEC_VP9 = 'vp09.00.41.08'
export const EXPORT_VIDEO_CODECS = [EXPORT_VIDEO_CODEC_AVC, EXPORT_VIDEO_CODEC_VP9]
