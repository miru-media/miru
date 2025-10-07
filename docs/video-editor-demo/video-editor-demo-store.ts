import { getCurrentScope, markRaw, onScopeDispose, ref, type Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import type * as Y from 'yjs'

import { promiseWithResolvers } from 'shared/utils'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

const DOC_NAME = 'video-editor-demo-doc'

export const useVideoEditorStore = (ydoc: Y.Doc): Ref<VideoEditorYjsStore | undefined> => {
  const store = ref<VideoEditorYjsStore>()
  if (import.meta.env.SSR) return store

  const scope = getCurrentScope()

  const idbPromise = promiseWithResolvers()

  void navigator.locks.request(DOC_NAME, async () => {
    if (!scope?.active) return

    const { promise, resolve } = promiseWithResolvers()

    const idb = new IndexeddbPersistence(DOC_NAME, ydoc)
    await idb.whenSynced
    idbPromise.resolve()

    scope.run(() => {
      onScopeDispose(() => {
        void idb.destroy()
        resolve()
      })
    })

    await promise
  })

  const webrtc = new WebrtcProvider(DOC_NAME, ydoc)

  void Promise.race([
    idbPromise.promise,
    new Promise<unknown>((resolve) => {
      ydoc.once('sync', resolve)
      webrtc.once('peers', () => ydoc.once('update', resolve))
    }),
  ]).then(() => {
    store.value = markRaw(new VideoEditorYjsStore(ydoc))
  })

  onScopeDispose(() => {
    webrtc.destroy()
  })

  return store
}
