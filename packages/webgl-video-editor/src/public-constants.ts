export { EXPORT_VIDEO_CODECS } from 'shared/video/constants.ts'

export const VIDEO_MIME_TYPES = ['webm', 'matroska', 'x-matroska', 'mp4', 'mov', 'quicktime'].map(
  (s) => `video/${s}`,
)
export const VIDEO_EXTENSIONS = ['.mp4', '.m4a', '.mov', '.movie', '.qt']
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png']
export const AUDIO_MIME_TYPES = [
  ...['ogg', 'webm', 'flac', 'wav', 'mp4', 'mpeg'].map((s) => `audio${s}`),
  'application/ogg',
]
export const AUDIO_EXTENSIONS = ['.flac', '.ogg', '.opus', '.aac', '.mp3', '.m4a']

export const ACCEPT_VIDEO_FILE_TYPES = [
  ...VIDEO_MIME_TYPES.map((s) => `video/${s}`),
  ...VIDEO_EXTENSIONS.map((e) => `.${e}`),
].join(',')
export const ACCEPT_IMAGE_FILE_TYPES = IMAGE_MIME_TYPES.join(',')
export const ACCEPT_VISUAL_FILE_TYPE = `${ACCEPT_VIDEO_FILE_TYPES},${ACCEPT_IMAGE_FILE_TYPES}`
export const ACCEPT_AUDIO_FILE_TYPES = `${AUDIO_MIME_TYPES.join(',')},${AUDIO_EXTENSIONS.join(',')}`

export { EDITOR_SELECTION_ACTIONS, EDITOR_SELECTION_ACTIONS_BY_ID } from './editor-actions.ts'

export const DEFAULT_STILL_CLIP_DURATION_S = 2
