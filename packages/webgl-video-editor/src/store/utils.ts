import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import { TIMELINE_ID } from '../constants.ts'
import type { Schema } from '../nodes/index.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY } from './constants.ts'

export const createInitialDocument = (): Schema.SerializedDocument =>
  ({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    assets: [],
    tracks: [],
  }) satisfies Schema.SerializedDocument

export const initYmapsFromJson = (
  ymaps: {
    tree: Y.Map<unknown>
    settings: Y.Map<unknown>
    assets?: Y.Map<Schema.AnyAsset>
  },
  content: Schema.SerializedDocument,
): void => {
  const ydoc = ymaps.tree.doc
  if (!ydoc) throw new Error('YMap must be bound to a doc!')

  ydoc.transact(() => {
    const ytree = new YTree(ymaps.tree)

    const addNodeAndChildren = (parentKey: string, init: Schema.AnyNodeSerializedSchema) => {
      ytree.createNode(
        parentKey,
        init.id,
        new Y.Map(Object.entries(init).filter(([key]) => key !== 'children')),
      )
      if ('children' in init) init.children.forEach((child) => addNodeAndChildren(init.id, child))
    }

    // create the null parent tree node if it's missing
    try {
      ytree.getNodeValueFromKey(YTREE_NULL_PARENT_KEY)
    } catch {
      ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, new Y.Map())
    }

    // create the timeline node if it's missing
    try {
      ytree.getNodeValueFromKey('timeline')
      content.tracks.forEach((track) => addNodeAndChildren('timeline', track))
    } catch {
      addNodeAndChildren(TIMELINE_ID, {
        id: 'timeline',
        type: 'timeline',
        children: content.tracks,
      } as const)
    }

    // update settings
    const { resolution, frameRate } = content
    const docSettings: Schema.DocumentSettings = { resolution, frameRate }
    for (const [K, v] of Object.entries(docSettings)) ymaps.settings.set(K, v)

    // add assets if YMap was provided
    if (ymaps.assets) for (const asset of content.assets) ymaps.assets.set(asset.id, asset)
  })
}
export const createInitialUpdate = (ymaps: {
  tree: Y.Map<unknown>
  settings: Y.Map<unknown>
  assets?: Y.Map<Schema.AnyAsset>
}): string => {
  initYmapsFromJson(ymaps, createInitialDocument())

  return Buffer.from(Y.encodeStateAsUpdateV2(ymaps.tree.doc!)).toString('base64')
}
