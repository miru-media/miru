import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type { SerializedMovie } from '../../types/schema'
import { ROOT_NODE_ID } from '../constants.ts'
import type { Schema } from '../nodes/index.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY } from './constants.ts'

export const createInitialMovie = (): SerializedMovie =>
  ({
    id: ROOT_NODE_ID,
    type: 'movie',
    assets: [],
    tracks: [],
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
  }) satisfies SerializedMovie

export const initYmapsFromJson = (
  treeYmap: Y.Map<unknown>,
  assetsYmap: Y.Map<Schema.AnyAsset> | undefined,
  content: SerializedMovie,
) => {
  const ydoc = treeYmap.doc
  if (!ydoc) throw new Error('YMap must be bound to a doc!')

  ydoc.transact(() => {
    const ytree = new YTree(treeYmap)

    const addNodeAndChildren = (parentKey: string, init: Schema.AnyNodeSerializedSchema) => {
      ytree.createNode(
        parentKey,
        init.id,
        new Y.Map(Object.entries(init).filter(([key]) => key !== 'children')),
      )
      if ('children' in init) init.children.forEach((child) => addNodeAndChildren(init.id, child))
    }

    const { type, resolution, frameRate } = content
    const movieProps: Schema.Movie = {
      id: ROOT_NODE_ID,
      type,
      resolution,
      frameRate,
    }

    // create the null parent tree node if it's missing
    try {
      ytree.getNodeValueFromKey(YTREE_NULL_PARENT_KEY)
    } catch {
      ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, new Y.Map())
    }

    // create or update the root movie node
    try {
      const ynode = ytree.getNodeValueFromKey(ROOT_NODE_ID) as Y.Map<unknown>
      Object.entries(movieProps).forEach(([K, v]) => ynode.set(K, v))
    } catch {
      ytree.createNode(YTREE_ROOT_KEY, ROOT_NODE_ID, new Y.Map(Object.entries(movieProps)))
    }

    // create the timeline node if it's missing
    try {
      ytree.getNodeValueFromKey('timeline')
      content.tracks.forEach((track) => addNodeAndChildren('timeline', track))
    } catch {
      addNodeAndChildren(ROOT_NODE_ID, {
        id: 'timeline',
        type: 'timeline',
        children: content.tracks,
      } as const)
    }

    // add assets if a YMap for it was provided
    if (assetsYmap) content.assets.forEach((asset) => assetsYmap.set(asset.id, asset))
  })
}
export const createInitialUpdate = (
  treeYmap: Y.Map<unknown>,
  assetsYmap?: Y.Map<Schema.AnyAsset>,
): string => {
  initYmapsFromJson(treeYmap, assetsYmap, createInitialMovie())

  return Buffer.from(Y.encodeStateAsUpdateV2(treeYmap.doc!)).toString('base64')
}
