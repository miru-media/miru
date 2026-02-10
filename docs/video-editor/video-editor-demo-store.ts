import * as base64 from 'base64-js'
import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

export const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQA8NAAJCBgAEShACAQNCEAALJwUoAScBKAUnACiuAZgBdmlkZW8tZWRpdG9yeXRyZWVyb290X3BhcmVudEhpc3RvcnludWxsdmFsdWVfcGFyZW50SGlzdG9yeXJvb3RtZXRhX19ST09UX05PREVfX19fUk9PVF9OT0RFX192YWx1ZWlkdHlwZWFzc2V0c3RyYWNrc3Jlc29sdXRpb25mcmFtZVJhdGVfcGFyZW50SGlzdG9yeXJvb3QMBQQOBAUORABNAAUCBEYACgkOBAcBAAAFAQAAAkEHAkEHARIAdgIHY291bnRlcn0ABW9yZGVydwXCgMKpB3cNX19ST09UX05PREVfX3cNX19ST09UX05PREVfX3cFbW92aWV1AHUAdgIFd2lkdGh9gB4GaGVpZ2h0fbgQfRh2Agdjb3VudGVyfQAFb3JkZXJ3BMOAHQoA'

export const useVideoEditorStore = (
  id: MaybeRefOrGetter<string>,
): { store: Ref<VideoEditorYjsStore | undefined>; webrtc: Ref<WebrtcProvider | undefined> } => {
  const store = ref<VideoEditorYjsStore>()
  const webrtc = ref<WebrtcProvider>()

  watch(
    toRef(id),
    (id, _prev, onCleanup) => {
      if (import.meta.env.SSR) return { store }
      if (!id) return

      const ydoc = new Y.Doc({ guid: id })
      Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))
      const idb = new IndexeddbPersistence(id, ydoc)

      let isStale = false

      onCleanup(() => {
        isStale = true
        webrtc.value?.destroy()
        void idb.destroy()
        ydoc.destroy()
        store.value?.dispose()
      })

      void idb.whenSynced.then(() => {
        if (isStale) return
        store.value = markRaw(new VideoEditorYjsStore(ydoc.getMap('video-editor')))
        webrtc.value = new WebrtcProvider(id, ydoc)
      })
    },
    { immediate: true },
  )

  return { store, webrtc }
}
