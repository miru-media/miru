export { EXPORT_VIDEO_CODECS } from 'shared/video/constants'

export const ACCEPT_VIDEO_FILE_TYPES =
  'video/webm,video/matroska,video/x-matroska,video/mp4,video/mov,video/quicktime,.mp4,.m4a,.mov,.quicktime,'
export const ACCEPT_AUDIO_FILE_TYPES = `audio/*,.mp3,.m4a,.flac,.ogg,.webm,${ACCEPT_VIDEO_FILE_TYPES}`
