export * from './publicConstants'

declare const VideoEditor: {
  name: 'VideoEditor'
  props: {
    messages: { type: typeof Object; required: false }
    languages: { type: typeof Array; required: false }
  }
  emits: ['error']
  setup(
    props: {
      messages?: Record<string, Record<string, string>>
      languages?: string[]
    },
    ctx: any,
  ): any
}

export default VideoEditor
