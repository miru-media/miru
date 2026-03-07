import * as base64 from 'base64-js'
import { markRaw, type MaybeRefOrGetter, type Ref, ref, toRef, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { YjsAssetStore, YjsSync } from 'webgl-video-editor/yjs'

export const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQA4PAQAEAAYABEoQAgBCCFYCABUnAiEBJwAoACcAKAAnAigBJwAoAKiYAYMBeXRyZWVyb290X3BhcmVudEhpc3Rvcnl2YWx1ZXJlc29sdXRpb25mcmFtZVJhdGV5dHJlZV9udWxsX3ZhbHVlX3BhcmVudEhpc3Rvcnlyb290YXNzZXRzeXRyZWV0aW1lbGluZXZhbHVlaWR0eXBlX3BhcmVudEhpc3RvcnlfbnVsbF8FBA4FCgkFBgUOBAYFCAUCBA4GCwEAAAMBAAADAQAAAkEHAkEHARIAdgB2Agdjb3VudGVyfQAFb3JkZXJ3BMKAYAZ3CHRpbWVsaW5ldwh0aW1lbGluZXYCB2NvdW50ZXJ9AAVvcmRlcncFwoDDgAd2AgV3aWR0aH2AHgZoZWlnaHR9uBB9GAEAAQMB'

export const useVideoEditorStore = (
  id: MaybeRefOrGetter<string>,
  onError: (error: unknown) => unknown,
): {
  sync: Ref<YjsSync | undefined>
  assets: Ref<YjsAssetStore | undefined>
  webrtc: Ref<WebrtcProvider | undefined>
  error: Ref<unknown>
} => {
  const sync = ref<YjsSync>()
  const webrtc = ref<WebrtcProvider>()
  const assets = ref<YjsAssetStore>()
  const error = ref<unknown>()

  watch(
    toRef(id),
    (id, _prev, onCleanup) => {
      if (import.meta.env.SSR) return { sync: sync }
      if (!id) return

      let ydoc
      let idb

      try {
        ydoc = new Y.Doc()
        Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))
        idb = new IndexeddbPersistence(id, ydoc)
        assets.value = new YjsAssetStore(ydoc.getMap('assets'))
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
        assets.value?.dispose()
        error.value = undefined
      })

      void idb.whenSynced
        .then(() => {
          if (isStale) return
          sync.value = markRaw(new YjsSync(ydoc))
          webrtc.value = new WebrtcProvider(id, ydoc)
        })
        .catch((error_: unknown) => {
          error.value = error_
          onError(error_)
        })
    },
    { immediate: true },
  )

  return { sync: sync, assets, webrtc, error }
}
