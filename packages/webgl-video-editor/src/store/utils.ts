import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type * as Schema from '#schema'

import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, TIMELINE_ID } from '../constants.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'

export const getOrCreateYmap = (root: Y.Doc | Y.Map<Y.Map<any>>, key: string) => {
  if ('getMap' in root) return root.getMap<any>(key)

  let subMap = root.get(key)
  if (!subMap) root.set(key, (subMap = new Y.Map()))

  return subMap
}

export const initYjsRoot = (root: Y.Doc | Y.Map<any>): { ytree: YTree; settings: Y.Map<any> } => {
  const ytree = new YTree(getOrCreateYmap(root, YTREE_YMAP_KEY))
  const settignsYmap = getOrCreateYmap(root, 'settings')

  const settings: Schema.DocumentSettings = {
    resolution: DEFAULT_RESOLUTION,
    frameRate: DEFAULT_FRAMERATE,
  }

  for (const [key, value] of Object.entries(settings))
    if (JSON.stringify(value) !== JSON.stringify(settignsYmap.get(key))) settignsYmap.set(key, value)

  try {
    ytree.getNodeValueFromKey(YTREE_NULL_PARENT_KEY)
  } catch {
    ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, {})
  }

  ytree.recomputeParentsAndChildren()

  return { ytree, settings: settignsYmap }
}

export const createInitialDocument = (): Schema.SerializedDocument =>
  ({
    resolution: { width: 1920, height: 1080 },
    frameRate: 24,
    assets: [],
    tracks: [],
  }) satisfies Schema.SerializedDocument

export const initYmapFromJson = ({
  root,
  content,
  assetsYmap,
}: {
  root: Y.Doc | Y.Map<any>
  content: Schema.SerializedDocument
  assetsYmap?: Y.Map<any>
}): void => {
  const ydoc = 'doc' in root ? root.doc : root

  if (!ydoc) throw new Error('YMap must be bound to a doc!')

  ydoc.transact(() => {
    const { ytree, settings } = initYjsRoot(root)

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
    for (const [K, v] of Object.entries(docSettings)) settings.set(K, v)

    // add assets
    if (assetsYmap) for (const asset of content.assets) assetsYmap.set(asset.id, asset)
  })
}

export const createInitialUpdate = (root: Y.Doc | Y.Map<unknown>): string => {
  initYmapFromJson({ root, content: createInitialDocument() })

  const doc = 'doc' in root ? root.doc! : root
  return Buffer.from(Y.encodeStateAsUpdateV2(doc)).toString('base64')
}
