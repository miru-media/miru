import { useIntervalFn } from '@vueuse/core'
// import { type MaybeRefOrGetter, toValue } from 'vue'
// import type { VideoEditor } from 'webgl-video-editor'

const THUMBNAIL_INTERVAL_MS = 5 * 1000

export const usePeriodicThumbnails = () // editor_: MaybeRefOrGetter<VideoEditor | undefined>,
// fn: (canvas: HTMLCanvasElement) => unknown,
// onError?: (error: unknown) => unknown,
: void => {
  if (!window.name) return

  useIntervalFn(
    () => {
      // const editor = toValue(editor_)
      // if (!editor) return
      // const promise = editor.getCanvasAtTime(Math.min(editor.doc.duration / 10, 10)).then(fn)
      // if (onError) promise.catch(onError)
    },
    THUMBNAIL_INTERVAL_MS,
    { immediateCallback: false },
  )
}
