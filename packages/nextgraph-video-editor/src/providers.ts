import { onScopeDispose } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import type * as Y from 'yjs'

import { NextGraphProvider } from './nextgraph-provider.ts'
import { getSession } from './nextgraph-session.ts'

export const setupProviders = async (
  nuri: string,
  ydoc: Y.Doc,
): Promise<[NextGraphProvider, IndexeddbPersistence]> => {
  const idbProvider = new IndexeddbPersistence(nuri, ydoc)
  let ngProvider: NextGraphProvider | undefined = undefined

  onScopeDispose(() => {
    void idbProvider.destroy()
    ngProvider?.destroy()
  })

  ngProvider = await getSession().then<NextGraphProvider>(
    (session) => new NextGraphProvider(nuri, ydoc, session!),
  )

  await Promise.all([idbProvider.whenSynced, ngProvider.whenConnected])

  return [ngProvider, idbProvider]
}
