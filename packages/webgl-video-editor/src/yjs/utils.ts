import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, TIMELINE_ID } from '#constants'
import type * as Schema from '#schema'

import { createInitialDocument } from '../sync/utils.ts'

import { YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'

export const getOrCreateYmap = (root: Y.Doc | Y.Map<Y.Map<any>>, key: string) => {
  if ('getMap' in root) return root.getMap<any>(key)

  let subMap = root.get(key)
  if (!subMap) root.set(key, (subMap = new Y.Map()))

  return subMap
}

const createYarrayOfYmaps = (values: Record<string, unknown>[]): Y.Array<Y.Map<unknown>> => {
  const yarray = new Y.Array<Y.Map<unknown>>()
  const ymaps = values.map((obj) => new Y.Map(Object.entries(obj)))

  yarray.insert(0, ymaps)
  return yarray
}

export const initYjsRoot = (
  root: Y.Doc | Y.Map<any>,
): { ytree: YTree; settings: Y.Map<any>; ydoc: Y.Doc } => {
  const ytree = new YTree(getOrCreateYmap(root, YTREE_YMAP_KEY))
  const settignsYmap = getOrCreateYmap(root, 'settings')

  const settings: Schema.DocumentSettings = {
    resolution: DEFAULT_RESOLUTION,
    frameRate: DEFAULT_FRAMERATE,
  }

  for (const [key, value] of Object.entries(settings))
    if (settignsYmap.get(key) == null) settignsYmap.set(key, value)

  try {
    ytree.getNodeValueFromKey(TIMELINE_ID)
  } catch {
    ytree.createNode(YTREE_ROOT_KEY, TIMELINE_ID, new Y.Map())
  }

  ytree.recomputeParentsAndChildren()

  return { ytree, settings: settignsYmap, ydoc: settignsYmap.doc! }
}

const updateYnodeFromJson = (ynode: Y.Map<unknown>, init: Schema.AnyNode): void => {
  Object.entries(init)
    .filter(([key]) => key !== 'children')
    .forEach(([key, value]) => {
      let yjsValue
      switch (key) {
        // effects are stored in YArrays although we never use more than one effect atm
        case 'effects':
          yjsValue = createYarrayOfYmaps((value as Schema.AnyNode['effects']) ?? [])
          break
        // TODO:
        case 'markers':
          yjsValue = createYarrayOfYmaps((value as Schema.AnyNode['markers']) ?? [])
          break
        // metadata is stored as a YMap of values
        case 'metadata':
          yjsValue = new Y.Map(Object.entries((value as typeof init.metadata) ?? {}))
          break
        // clip.gap prop is skipped and handled elsewhere
        case 'gap':
          break
        default:
          yjsValue =
            typeof value === 'object' && value != null && 'toJSON' in value
              ? (value.toJSON as () => any)()
              : value
      }

      ynode.set(key, yjsValue)
    })
}

export const createYnodeFromJson = (init: Schema.AnyNode | Schema.AnySerializedNode): Y.Map<unknown> => {
  const ymap = new Y.Map()
  updateYnodeFromJson(ymap, init)

  // gaps are stored as a map of other clip IDs to Rational duration
  if (init.type.startsWith('clip:')) ymap.set('gap', new Y.Map())
  return ymap
}

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

  const init = (): void => {
    const { ytree, settings } = initYjsRoot(root)

    const addNodeAndChildren = (
      parentKey: string,
      init: Schema.AnySerializedNode,
      prevChildId: string,
      createNode: boolean,
    ) => {
      let ynode
      if (createNode) ytree.createNode(parentKey, init.id, (ynode = createYnodeFromJson(init)))
      else ynode = ytree.getNodeValueFromKey(init.id) as Y.Map<unknown>

      if ('gap' in init && init.gap && init.gap.value !== 0)
        (ynode.get('gap') as Y.Map<Schema.Rational>).set(prevChildId, init.gap)

      if ('children' in init) {
        let prevChildId = ''
        init.children.forEach((child) => {
          addNodeAndChildren(init.id, child, prevChildId, true)
          prevChildId = child.id
        })
      }
    }

    addNodeAndChildren('', content.timeline, '', false)

    // update doc settings
    const { resolution, frameRate } = content
    const docSettings: Schema.DocumentSettings = { resolution, frameRate }
    for (const [K, v] of Object.entries(docSettings)) settings.set(K, v)

    // add assets
    if (assetsYmap) for (const asset of content.assets) assetsYmap.set(asset.id, asset)
  }

  if (ydoc) ydoc.transact(init)
  else init()
}

export const createInitialUpdate = (root: Y.Doc | Y.Map<unknown>): string => {
  initYmapFromJson({ root, content: createInitialDocument() })

  const doc = 'doc' in root ? root.doc! : root
  return Buffer.from(Y.encodeStateAsUpdateV2(doc)).toString('base64')
}
