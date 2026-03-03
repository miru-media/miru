import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type * as Schema from '#schema'

import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, TIMELINE_ID } from '../constants.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY } from './constants.ts'

export const getOrCreateYmap = (ymap: Y.Map<Y.Map<any>>, key: string) => {
  let subMap = ymap.get(key)
  if (!subMap) ymap.set(key, (subMap = new Y.Map()))

  return subMap
}

export const initYtree = (
  ymap: Y.Map<unknown>,
): { ytree: YTree; doc: Y.Map<any>; assets: Y.Map<Schema.AnyAssetSchema> } => {
  const ytree = new YTree(ymap)

  let doc = ytree.getNodeValueFromKey(YTREE_ROOT_KEY) as Y.Map<any> | undefined
  if (!doc) {
    ytree.setNodeValueFromKey(YTREE_ROOT_KEY, (doc = new Y.Map()))

    const settings: Schema.DocumentSettings = {
      resolution: DEFAULT_RESOLUTION,
      frameRate: DEFAULT_FRAMERATE,
    }

    for (const [key, value] of Object.entries(settings)) doc.set(key, value)
  }

  try {
    ytree.getNodeValueFromKey(YTREE_NULL_PARENT_KEY)
  } catch {
    ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, {})
  }

  ytree.recomputeParentsAndChildren()

  const assets = getOrCreateYmap(doc, 'assets')

  return { ytree, doc, assets }
}

export const createInitialDocument = (): Schema.SerializedDocument =>
  ({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    assets: [],
    tracks: [],
  }) satisfies Schema.SerializedDocument

export const initTreeYmapFromJson = (treeYmap: Y.Map<unknown>, content: Schema.SerializedDocument): void => {
  const ydoc = treeYmap.doc
  if (!ydoc) throw new Error('YMap must be bound to a doc!')

  ydoc.transact(() => {
    const { ytree, doc, assets } = initYtree(treeYmap)

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
      content.tracks.forEach((track) => addNodeAndChildren(TIMELINE_ID, track))
    } catch {
      addNodeAndChildren(YTREE_NULL_PARENT_KEY, {
        id: TIMELINE_ID,
        type: 'timeline',
        children: content.tracks,
      } as const)
    }

    // update doc settings
    const { resolution, frameRate } = content
    const docSettings: Schema.DocumentSettings = { resolution, frameRate }
    for (const [K, v] of Object.entries(docSettings)) doc.set(K, v)

    // add assets
    for (const asset of content.assets) assets.set(asset.id, asset)
  })
}

export const createInitialUpdate = (ymap: Y.Map<unknown>): string => {
  initTreeYmapFromJson(ymap, createInitialDocument())

  return Buffer.from(Y.encodeStateAsUpdateV2(ymap.doc!)).toString('base64')
}
