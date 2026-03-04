import * as base64 from 'base64-js'
import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { YTREE_YMAP_KEY } from 'webgl-video-editor/store/constants.js'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'
import { YjsAssetStore } from 'webgl-video-editor/store/yjs-asset-store.js'

export const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQA4PAQAEAAYABEoQAgBCCFYCABUnAiEBJwAoACcAKAAnAigBJwAoAKiYAYMBeXRyZWVyb290X3BhcmVudEhpc3Rvcnl2YWx1ZXJlc29sdXRpb25mcmFtZVJhdGV5dHJlZV9udWxsX3ZhbHVlX3BhcmVudEhpc3Rvcnlyb290YXNzZXRzeXRyZWV0aW1lbGluZXZhbHVlaWR0eXBlX3BhcmVudEhpc3RvcnlfbnVsbF8FBA4FCgkFBgUOBAYFCAUCBA4GCwEAAAMBAAADAQAAAkEHAkEHARIAdgB2Agdjb3VudGVyfQAFb3JkZXJ3BMKAYAZ3CHRpbWVsaW5ldwh0aW1lbGluZXYCB2NvdW50ZXJ9AAVvcmRlcncFwoDDgAd2AgV3aWR0aH2AHgZoZWlnaHR9uBB9GAEAAQMB'

export const useVideoEditorStore = (
  id: MaybeRefOrGetter<string>,
): {
  store: Ref<VideoEditorYjsStore | undefined>
  assets: Ref<YjsAssetStore | undefined>
  webrtc: Ref<WebrtcProvider | undefined>
} => {
  const store = ref<VideoEditorYjsStore>()
  const webrtc = ref<WebrtcProvider>()
  const assets = ref<YjsAssetStore>()

  watch(
    toRef(id),
    (id, _prev, onCleanup) => {
      if (import.meta.env.SSR) return { store }
      if (!id) return

      const ydoc = new Y.Doc()
      Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))
      const idb = new IndexeddbPersistence(id, ydoc)
      assets.value = new YjsAssetStore(ydoc.getMap('assets'))

      let isStale = false

      onCleanup(() => {
        isStale = true
        webrtc.value?.destroy()
        void idb.destroy()
        ydoc.destroy()
        store.value?.dispose()
        assets.value?.dispose()
      })

      void idb.whenSynced.then(() => {
        if (isStale) return
        store.value = markRaw(new VideoEditorYjsStore(ydoc.getMap(YTREE_YMAP_KEY)))
        webrtc.value = new WebrtcProvider(id, ydoc)
      })
    },
    { immediate: true },
  )

  return { store, assets, webrtc }
}
