import { insertObject } from '@ng-org/orm'
import type { Session } from '@ng-org/web'
import type { Schema } from 'webgl-video-editor'
import * as Y from 'yjs'

import { initYmapFromJson } from 'webgl-video-editor/store/utils.js'

import { INITIAL_DOC_UPDATE, OBJECT_ID_LENGTH } from './constants.ts'
import { NextGraphAssetStore } from './nextgraph-asset-store.ts'
import { digestToString } from './nextgraph-provider.ts'
import { MiruVideoDocumentShapeType } from './shapes/orm/video.shapeTypes.ts'

export const nuriToObjectId = (nuri: string) => nuri.slice(0, OBJECT_ID_LENGTH)

export const createNextGraphDoc = async ({
  session,
  name = 'Untitled',
  content = undefined,
}: {
  session: Session
  name: string
  content: Schema.SerializedDocument | undefined
}): Promise<string> => {
  const { ng, session_id: sessionId } = session

  const nuri = (await ng.doc_create(
    sessionId,
    'YMap',
    import.meta.env.DEV ? 'data:map' : 'video:miru',
    'store',
    undefined,
  )) as string

  const objectId = nuriToObjectId(nuri)

  if (content) {
    const heads: string[] = []

    await new Promise<void>((resolve, reject) => {
      ng.doc_subscribe(objectId, sessionId, (response: { V0: { State?: Record<string, any> } }) => {
        if (!response.V0.State) return

        for (const head of response.V0.State.heads) heads.push(digestToString(head))
        resolve()
      }).catch(reject)
    })

    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, INITIAL_DOC_UPDATE)
    initYmapFromJson({ root: ydoc.getMap('ng'), content })

    await ng.discrete_update(sessionId, Y.encodeStateAsUpdate(ydoc), heads, 'YMap', nuri)
    ydoc.destroy()
  }

  await insertObject(MiruVideoDocumentShapeType, {
    '@graph': nuri,
    '@id': objectId,
    '@type': 'did:ng:z:MiruVideoDocument',
    name,
    assets: new Set(content?.assets.map((asset) => NextGraphAssetStore.assetToOrmShape(asset, nuri))),
    createdAt: new Date().toISOString(),
  })

  return nuri
}
