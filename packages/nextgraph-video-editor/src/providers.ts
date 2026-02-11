import { onScopeDispose } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import type * as Y from 'yjs'

import { NextGraphProvider } from './nextgraph-provider.ts'
import { getSession } from './nextgraph-session.ts'

export const setupProviders = (
  nuri: string,
  ydoc: Y.Doc,
): Promise<[NextGraphProvider, IndexeddbPersistence]> => {
  const idbProvider = new IndexeddbPersistence(nuri, ydoc)
  let ngProvider: NextGraphProvider | undefined

  const promises = [
    getSession().then((session) => (ngProvider = new NextGraphProvider(nuri, ydoc, session))),
    idbProvider.whenSynced,
  ] as const

  onScopeDispose(() => {
    void idbProvider.destroy()
    ngProvider?.destroy()
  })

  return Promise.all(promises).then(([nextgraphProvider]) => [nextgraphProvider, idbProvider] as const)
}
