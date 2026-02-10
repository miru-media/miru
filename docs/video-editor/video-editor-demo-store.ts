import * as base64 from 'base64-js'
import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

export const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQBIQAAQABQACAQNCEAQCAQBCCgATJwQoACcBKAUnACgAJwEoAicAKNkBvAF5dHJlZXJvb3RfcGFyZW50SGlzdG9yeXl0cmVlbnVsbHZhbHVlX3BhcmVudEhpc3Rvcnlyb290eXRyZWVfX1JPT1RfTk9ERV9fdmFsdWVpZHR5cGVhc3NldHN0cmFja3NyZXNvbHV0aW9uZnJhbWVSYXRlX3BhcmVudEhpc3Rvcnlyb290eXRyZWV0aW1lbGluZXZhbHVlaWR0eXBla2luZF9wYXJlbnRIaXN0b3J5X19ST09UX05PREVfXwUEDgUEBQ4EBQ0FAgRGAAoJDgQFCAUCRAAODQ8BAAAAAQAAAgEAAAgBAAACQQkCQQoBFwB2Agdjb3VudGVyfQAFb3JkZXJ3BMKABAd3DV9fUk9PVF9OT0RFX193BW1vdmlldQB1AHYCBXdpZHRofYAeBmhlaWdodH24EH0YdgIHY291bnRlcn0ABW9yZGVydwTDgDIJdwh0aW1lbGluZXcKY29sbGVjdGlvbncIdGltZWxpbmV2Agdjb3VudGVyfQAFb3JkZXJ3BcKAwqABAA=='

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
        store.value = markRaw(new VideoEditorYjsStore(ydoc.getMap(YTREE_YMAP_KEY), ydoc.getMap('assets')))
        webrtc.value = new WebrtcProvider(id, ydoc)
      })
    },
    { immediate: true },
  )

  return { store, webrtc }
}
