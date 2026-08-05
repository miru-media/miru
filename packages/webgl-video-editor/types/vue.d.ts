import type * as pub from '#core'

declare const VideoEditorComponent: {
  name: 'VideoEditor'
  props: {
    messages: { type: typeof Object; required: false }
    languages: { type: typeof Array; required: false }
  }
  emits: ['error']
  setup: (
    props: {
      messages?: Record<string, Record<string, string>>
      languages?: string[]
    },
    ctx: any,
  ) => any
}

/** VideoEditor class with props wrapped for vue reactivity */
export class VideoEditor implements pub.VideoEditor {} // eslint-disable-line @typescript-eslint/no-extraneous-class -- for jsdoc

export default VideoEditorComponent

export * from './public-constants.ts'
