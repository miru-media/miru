import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type { SerializedMovie } from '../../types/schema'
import { ROOT_NODE_ID } from '../constants.ts'
import type { Schema } from '../nodes/index.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'

export const createInitialMovie = (generateId: () => string): SerializedMovie =>
  ({
    id: ROOT_NODE_ID,
    type: 'movie',
    assets: [],
    tracks: [
      { id: generateId(), type: 'track', trackType: 'video', children: [] },
      { id: generateId(), type: 'track', trackType: 'audio', children: [] },
    ],
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
  }) satisfies SerializedMovie

export const createInitialUpdate = (ymap: Y.Map<unknown>): string => {
  const ydoc = ymap.doc
  if (!ydoc) throw new Error('YMap must be added to a doc!')

  ydoc.transact(() => {
    const ytreeMap = new Y.Map()
    ymap.set(YTREE_YMAP_KEY, ytreeMap)

    const ytree = new YTree(ytreeMap)

    ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, new Y.Map())

    const initialContent = createInitialMovie(() => ytree.generateNodeKey())

    const addNode = (parentKey: string, init: Schema.AnyNodeSerializedSchema) => {
      ytree.createNode(
        parentKey,
        init.id,
        new Y.Map(Object.entries(init).filter(([key]) => key !== 'children')),
      )
      if ('children' in init) init.children.forEach((child) => addNode(init.id, child))
    }

    ydoc.getMap('meta').set(ROOT_NODE_ID, initialContent.id)
    addNode(YTREE_ROOT_KEY, initialContent)
  })

  return Buffer.from(Y.encodeStateAsUpdateV2(ydoc)).toString('base64')
}
