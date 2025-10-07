import { onScopeDispose } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import WebxdcProvider from 'y-webxdc'
import type * as Y from 'yjs'

import { FIRST_SYNC_AWAIT_TIMEOUT, IDB_DOC_NAME } from './cosntants.ts'

export const setupProviders = (docName: string, ydoc: Y.Doc): Promise<IndexeddbPersistence> => {
  const promises: Promise<unknown>[] = []

  const idbProvider = new IndexeddbPersistence(docName, ydoc)
  promises.push(idbProvider.whenSynced)

  const { webxdc } = window
  let webxdcProvider: WebxdcProvider

  if (typeof webxdc !== 'undefined') {
    const DEFAULT_WEBXDC_INTERVAL = 10_000
    const autosaveInterval =
      (webxdc as { sendUpdateInterval?: number }).sendUpdateInterval ?? DEFAULT_WEBXDC_INTERVAL
    const getEditInfo = () => {
      const summary = `Last edit: ${webxdc.selfName}`
      const startinfo = `${webxdc.selfName} editing`
      return { summary, startinfo, document: docName === IDB_DOC_NAME ? undefined : docName }
    }

    webxdcProvider = new WebxdcProvider({
      webxdc,
      ydoc,
      autosaveInterval,
      getEditInfo,
    })

    promises.push(
      new Promise<void>((resolve) => {
        webxdcProvider.on('sync', resolve)
        setTimeout(resolve, FIRST_SYNC_AWAIT_TIMEOUT)
      }),
    )
  }

  onScopeDispose(() => {
    void idbProvider.destroy()
  })

  return Promise.all(promises).then(() => idbProvider)
}
