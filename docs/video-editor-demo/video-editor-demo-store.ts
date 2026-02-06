import * as base64 from 'base64-js'
import { getCurrentScope, markRaw, onScopeDispose, ref, type Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebrtcProvider } from 'y-webrtc'
import * as Y from 'yjs'

import { promiseWithResolvers } from 'shared/utils'
import { VideoEditorYjsStore } from 'webgl-video-editor/store/yjs.js'

const DOC_NAME = 'video-editor-demo-doc'

const INITIAL_DOC_UPDATE_BASE64 =
  'AAACQA8NAAJCCAIBA0IQWBwABAAPJwIoACcBKAUnACgAJwIoswGdAXZpZGVvLWVkaXRvcnl0cmVlcm9vdF9wYXJlbnRIaXN0b3J5bWV0YV9fUk9PVF9OT0RFX19fX1JPT1RfTk9ERV9fdmFsdWVpZHR5cGVhc3NldHN0cmFja3NyZXNvbHV0aW9uZnJhbWVSYXRlX3BhcmVudEhpc3Rvcnlyb290X2RlbGV0ZWRfdmFsdWVfcGFyZW50SGlzdG9yeXJvb3QMBQQOBE0ABQIERgAKCQ4ECQUOBAcBAAABAQAAAkEHAkEHARIAdw1fX1JPT1RfTk9ERV9fdw1fX1JPT1RfTk9ERV9fdwVtb3ZpZXUAdQJ2BAJpZHcJMDI0MzY0NTIxBHR5cGV3BXRyYWNrCXRyYWNrVHlwZXcFdmlkZW8IY2hpbGRyZW51AHYEAmlkdwkwMzU0NTk1OTkEdHlwZXcFdHJhY2sJdHJhY2tUeXBldwVhdWRpbwhjaGlsZHJlbnUAdgIFd2lkdGh9gB4GaGVpZ2h0fbgQfRh2Agdjb3VudGVyfQAFb3JkZXJ3BcKAw4gJdgIHY291bnRlcn0ABW9yZGVydwXDgMKKAwA='

export const useVideoEditorStore = (
  ydoc: Y.Doc,
): { store: Ref<VideoEditorYjsStore | undefined>; webrtc?: WebrtcProvider } => {
  const store = ref<VideoEditorYjsStore>()
  Y.applyUpdateV2(ydoc, base64.toByteArray(INITIAL_DOC_UPDATE_BASE64))

  if (import.meta.env.SSR) return { store }

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
    store.value = markRaw(new VideoEditorYjsStore(ydoc.getMap('video-editor')))
  })

  onScopeDispose(() => {
    webrtc.destroy()
  })

  return { store, webrtc }
}
