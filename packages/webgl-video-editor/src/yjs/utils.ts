/* eslint-disable @typescript-eslint/no-unsafe-call -- missing YTree types in fix branch */
import { PositionSource } from 'position-strings'
import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import { Keyframe } from '#animation'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, TIMELINE_ID } from '#constants'
import type * as pub from '#core'
import type * as Schema from '#schema'

import { createInitialDocument } from '../sync/utils.ts'

import { YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'
import type { YjsSync } from './yjs-sync.ts'

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
): { ytree: YTree; settings: Y.Map<any>; links: Y.Array<Schema.NodeLink>; ydoc: Y.Doc } => {
  const positionSource = new PositionSource()
  const ytree = new YTree(getOrCreateYmap(root, YTREE_YMAP_KEY), {
    insertBetween: positionSource.createBetween.bind(positionSource),
  })
  const settignsYmap = getOrCreateYmap(root, 'settings')
  const linksArray =
    'getArray' in root
      ? root.getArray<Schema.NodeLink>('links')
      : (root.get('links') as Y.Array<Schema.NodeLink>)

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

  return { ytree, settings: settignsYmap, links: linksArray, ydoc: settignsYmap.doc! }
}

export const getValidLinksFromYarray = (
  doc: pub.Document,
  links: Y.Array<Schema.NodeLink>,
): Map<string, Schema.NodeLink> => {
  const valid = new Map<string, Schema.NodeLink>()
  const linkedNodeIds = new Set<string>()

  for (let i = links.length - 1; i >= 0; i--) {
    const link = links.get(i)

    if (link.nodes.some(({ id }) => linkedNodeIds.has(id))) continue

    const resolvableItems = link.nodes.filter(({ id }) => doc.nodes.has(id))
    if (resolvableItems.length < 2) continue

    // clips must not be on the same track
    const trackIds = new Set<string>()
    for (const item of link.nodes) {
      if (item.type.startsWith('track')) continue

      const parentId = doc.nodes.get(item.id).parent?.id
      if (!parentId || trackIds.has(parentId)) continue
      trackIds.add(parentId)
    }

    valid.set(link.id, link)
  }

  return valid
}

export const createYnodeFromJson = (init: Schema.AnyNode | Schema.AnySerializedNode): Y.Map<unknown> => {
  const ynode = new Y.Map()

  Object.entries(init)
    .filter(([key]) => key !== 'children' && Object.hasOwn(init, key))
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
          yjsValue = new Y.Map(
            Object.entries((value as typeof init.metadata) ?? {}).filter(([key]) =>
              Object.hasOwn(value, key),
            ),
          )
          break
        case 'gap':
        case 'animations':
          break

        default:
          yjsValue =
            typeof value === 'object' && value != null && 'toJSON' in value
              ? (value.toJSON as () => any)()
              : value
      }

      ynode.set(key, yjsValue)
    })

  // gaps are stored as a map of other clip IDs to Rational duration
  if (init.type.startsWith('clip:')) ynode.set('gap', new Y.Map())

  const ynodeAnimations = ynode.set('animations', new Y.Map<unknown>())

  if (init.animations) {
    const { animations } = init

    Object.entries(animations).forEach(([key, init]) => {
      const animationYmap = ynodeAnimations.set(key, new Y.Map<unknown>())
      if (!Object.hasOwn(animations, key) || !init) return
      const keyframes = animationYmap.set('keyframes', new Y.Array())

      init.keyframes.forEach((init) =>
        keyframes.push([new Y.Map(Object.entries(init).filter(([key]) => Object.hasOwn(init, key)))]),
      )
    })
  }

  return ynode
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
    const { ytree, settings, links } = initYjsRoot(root)

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
    links.push(content.links)

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

const jsonValuesAreEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

export const updateYmap = (ymap: Y.Map<unknown>, updates: Record<string, unknown>): void => {
  for (const key in updates) {
    if (Object.hasOwn(updates, key)) {
      const newValue = updates[key]
      if (!jsonValuesAreEqual(newValue, ymap.get(key)))
        ymap.set(
          key,
          typeof newValue === 'object' && newValue != null && 'toJSON' in newValue
            ? (newValue.toJSON as () => any)()
            : newValue,
        )
    }
  }
}

export const findIndexByIdProp = (yarray: Y.Array<any>, id: string): number => {
  const { length } = yarray
  for (let i = 0; i < length; i++) if (yarray.get(i).id === id) return i
  return -1
}

export const onYnodeKeyframeListChange = (node: pub.AnyNode, key: string, event: Y.YEvent<any>): void => {
  let pos = 0
  const animation = node.animations[key]!

  event.changes.delta.forEach(({ retain, insert, delete: del }) => {
    if (typeof retain === 'number') pos += retain
    else if (Array.isArray(insert)) {
      insert.forEach((item) => animation.insert(pos, new Keyframe((item as Y.Map<any>).toJSON() as any)))
    } else if (typeof del === 'number') {
      for (let i = 0; i < del; i++) animation.delete(pos)
    }
  })
}

export const serializeYdoc = (sync: YjsSync) => {
  const ytree = new YTree(getOrCreateYmap(sync.ydoc, YTREE_YMAP_KEY))

  const serialize = <T extends Schema.AnySerializedNode = Schema.AnySerializedNode>(nodeId: string): T => {
    const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
    const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(nodeId), nodeId)

    return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
  }

  return {
    ...(sync.settingsYmap.toJSON() as Schema.DocumentSettings),
    timeline: serialize(sync.doc.timeline.id),
    links: sync.linksYarray.toArray(),
  }
}
