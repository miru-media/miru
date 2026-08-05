import { useDebounceFn } from '@vueuse/core'
import { type MaybeRefOrGetter, toValue, watch } from 'vue'
import type { VideoEditor } from 'webgl-video-editor'

import { fit } from 'shared/utils'

const THUMBNAIL_DEBOUNCE_MS = 2_000
const THUMBNAIL_MAX_WAIT_MS = 10_000
const THUMBNAIL_SIZE = { width: 448, height: 252 }

export const useEditorThumbnail = (
  editor_: MaybeRefOrGetter<VideoEditor | undefined>,
  fn: (canvas: OffscreenCanvas) => unknown,
  onError?: (error: unknown) => unknown,
): void => {
  const canvas = new OffscreenCanvas(THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height)

  const debounced = useDebounceFn(
    (editor: VideoEditor) => {
      try {
        const context = canvas.getContext('2d')
        if (!context) throw new Error(`Couldn't get 2d context for thumbnail`)

        const fitSize = fit(editor.canvas, THUMBNAIL_SIZE, 'cover')

        editor.playback.renderView.render()
        context.drawImage(editor.canvas, fitSize.x, fitSize.y, fitSize.width, fitSize.height)
        fn(canvas)
      } catch (error: unknown) {
        onError?.(error)
      }
    },
    THUMBNAIL_DEBOUNCE_MS,
    { maxWait: THUMBNAIL_MAX_WAIT_MS },
  )

  watch(
    () => toValue(editor_),
    (editor, _prev, onCleanup) => {
      if (!editor) return
      const abort = new AbortController()
      editor.sync?.addEventListener('change', () => void debounced(editor), { signal: abort.signal })
      onCleanup(abort.abort.bind(abort))
    },
  )
}
