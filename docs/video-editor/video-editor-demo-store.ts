import * as base64 from 'base64-js'
import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

export const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQAgJAAQABQACAEIIAAsnBCgAJwEoAScAKJkBhAF5dHJlZXJvb3RfcGFyZW50SGlzdG9yeXl0cmVlbnVsbHZhbHVlX3BhcmVudEhpc3Rvcnlyb290eXRyZWV0aW1lbGluZXZhbHVlaWR0eXBlX3BhcmVudEhpc3RvcnludWxsc2V0dGluZ3NyZXNvbHV0aW9uc2V0dGluZ3NmcmFtZVJhdGUFBA4FBAUOBAUIBQIEDgQICggJDQEAAAABAAACAQAABAECQQYCQQQBDgB2Agdjb3VudGVyfQAFb3JkZXJ3BMKABw93CHRpbWVsaW5ldwh0aW1lbGluZXYCB2NvdW50ZXJ9AAVvcmRlcncFwoDCkwh2AgV3aWR0aH2AHgZoZWlnaHR9uBB9GAA='

export const useVideoEditorStore = (
  id: MaybeRefOrGetter<string>,
): {
  store: Ref<VideoEditorYjsStore | undefined>
  webrtc: Ref<WebrtcProvider | undefined>
} => {
  const store = ref<VideoEditorYjsStore>()
  const webrtc = ref<WebrtcProvider>()

  watch(
    toRef(id),
    (id, _prev, onCleanup) => {
      if (import.meta.env.SSR) return { store }
      if (!id) return

      const ydoc = new Y.Doc()
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
        store.value = markRaw(
          new VideoEditorYjsStore({
            tree: ydoc.getMap(YTREE_YMAP_KEY),
            settings: ydoc.getMap('settings'),
            assets: ydoc.getMap('assets'),
          }),
        )
        webrtc.value = new WebrtcProvider(id, ydoc)
      })
    },
    { immediate: true },
  )

  return { store, webrtc }
}
