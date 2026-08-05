import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { VideoEditor } from 'webgl-video-editor/vue'
import { YjsAssetStore, YjsSync } from 'webgl-video-editor/yjs'

export const useSyncedVideoEditor = (
  id: MaybeRefOrGetter<string>,
  onError: (error: unknown) => unknown,
): {
  sync: Ref<YjsSync | undefined>
  editor: Ref<VideoEditor | undefined>
  webrtc: Ref<WebrtcProvider | undefined>
  error: Ref<unknown>
} => {
  const sync = ref<YjsSync>()
  const editor = ref<VideoEditor>()
  const webrtc = ref<WebrtcProvider>()
  const error = ref<unknown>()

  watch(
    toRef(id),
    (id, _prev, onCleanup) => {
      if (import.meta.env.SSR) return { sync, editor }
      if (!id) return

      let ydoc
      let idb

      try {
        ydoc = new Y.Doc()
        idb = new IndexeddbPersistence(id, ydoc)
      } catch (error_: unknown) {
        error.value = error_
        onError(error_)
        return
      }

      let isStale = false

      onCleanup(() => {
        isStale = true
        webrtc.value?.destroy()
        void idb.destroy()
        ydoc.destroy()
        sync.value?.dispose()
        editor.value?.dispose()
        error.value = editor.value = sync.value = undefined
      })

      void idb.whenSynced
        .then(() => {
          if (isStale) return
          sync.value = markRaw(new YjsSync(ydoc, new YjsAssetStore(ydoc.getMap('assets'))))
          editor.value = new VideoEditor({ sync: sync.value })

          webrtc.value = markRaw(new WebrtcProvider(id, ydoc))
        })
        .catch((error_: unknown) => {
          error.value = error_
          onError(error_)
        })
    },
    { immediate: true },
  )

  return { sync, editor, webrtc, error }
}
