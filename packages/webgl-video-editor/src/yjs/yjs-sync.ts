import { ref } from 'fine-jsx'
import type { Size } from 'webgl-effects'
import * as Y from 'yjs'
import type { YTree } from 'yjs-orderedtree'

import type * as pub from '#core'
import type { DocumentSettings } from '#schema'
import type {
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  Schema,
  SettingsUpdateEvent,
} from 'webgl-video-editor'

import { TIMELINE_ID } from '../constants.ts'
import { Document } from '../document.ts'
import { NodeCreateEvent } from '../events.ts'

import { YTREE_ROOT_KEY } from './constants.ts'
import { createYnodeFromJson, initYjsRoot, initYmapFromJson } from './utils.ts'

const jsonValuesAreEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

const updateYmap = (ymap: Y.Map<unknown>, updates: Record<string, unknown>): void => {
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

const OBSERVED = new WeakSet<Y.Map<unknown>>()

export class YjsSync implements pub.VideoEditorDocumentSync {
  doc!: pub.Document

  readonly ydoc: Y.Doc
  readonly settingsYmap: Y.Map<unknown>
  readonly #ytree!: YTree
  readonly #yundo!: Y.UndoManager

  readonly #canUndo = ref(false)
  readonly #canRedo = ref(false)
  get canUndo(): boolean {
    return this.#canUndo.value
  }
  get canRedo(): boolean {
    return this.#canRedo.value
  }

  readonly #abort = new AbortController()

  #isSyncingYdocToVideoDoc = false
  get #shouldSkipNodeEvent(): boolean {
    return this.#yundo.undoing || this.#yundo.redoing || this.#isSyncingYdocToVideoDoc
  }

  isDisposed = false

  constructor(ydocOrMap: Y.Doc | Y.Map<any>, assets?: pub.VideoEditorAssetStore) {
    const doc = (this.doc = new Document({ assets }))

    const { ytree, settings, ydoc } = initYjsRoot(ydocOrMap)

    // update ndoes with old 'clip' type
    {
      const allIds: string[] = []
      ytree.getAllDescendants(YTREE_ROOT_KEY, allIds)
      allIds.forEach((id) => {
        const ynode = ytree.getNodeValueFromKey(id) as Y.Map<any>
        if ((ynode as any)?.get == null) return
        const type: string = ynode.get('type')
        if (type === 'clip') ynode.set('type', `clip:${ynode.get('clipType')}`)
      })
    }

    ydoc.on('destroy', this.dispose.bind(this))

    this.ydoc = ydoc
    this.#ytree = ytree
    this.#yundo = new Y.UndoManager([ytree._ymap, settings])
    this.settingsYmap = settings

    doc.resolution = settings.get('resolution') as Size
    doc.frameRate = settings.get('frameRate') as number

    const onYtreeMapEvent = this.#onYtreeMapEvent.bind(this)
    this.#ytree._ymap.observe(onYtreeMapEvent)

    this.#ytree.observe(this.#onYtreeChange)

    this.#abort.signal.addEventListener('abort', () => {
      this.#ytree._ymap.unobserve(onYtreeMapEvent)
      this.#ytree.unobserve(this.#onYtreeChange)
    })

    doc.nodes.forEach((node) => this.#onNodeCreate(new NodeCreateEvent(node)))

    const bindNodeListener = <T extends unknown[]>(
      listener_: (...args: T) => unknown,
    ): ((...args: T) => void) => {
      const listener = listener_.bind(this)
      return (...args) => {
        if (!this.#shouldSkipNodeEvent) this.transact(() => listener(...args))
      }
    }

    const listenerOptions: AddEventListenerOptions = { signal: this.#abort.signal }
    doc.on('doc:dispose', this.dispose.bind(this), listenerOptions)
    /* eslint-disable @typescript-eslint/unbound-method -- false positive */
    doc.on('settings:update', bindNodeListener(this.#onSettingsUpdate), listenerOptions)
    doc.on('node:create', bindNodeListener(this.#onNodeCreate), listenerOptions)
    doc.on('node:move', bindNodeListener(this.#onMove), listenerOptions)
    doc.on('node:update', bindNodeListener(this.#onUpdate), listenerOptions)
    doc.on('node:delete', bindNodeListener(this.#onDelete), listenerOptions)
    /* eslint-enable @typescript-eslint/unbound-method */

    this.#onYtreeChange()

    const onStackChange = (): void => {
      const yundo = this.#yundo
      this.#canUndo.value = yundo.canUndo()
      this.#canRedo.value = yundo.canRedo()
    }

    const yundo = this.#yundo
    yundo.ignoreRemoteMapChanges = true
    yundo.on('stack-cleared', onStackChange)
    yundo.on('stack-item-added', onStackChange)
    yundo.on('stack-item-popped', onStackChange)
    yundo.clear()
  }

  transact<T>(fn: () => T): T {
    return this.ydoc.transact(fn)
  }

  undo(): void {
    this.#yundo.undo()
  }
  redo(): void {
    this.#yundo.redo()
  }

  #getYtreeNode(nodeId: string): Y.Map<unknown> {
    return this.#ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
  }

  readonly #onYnodeChange = (event: Y.YMapEvent<unknown>): void => {
    this.#isSyncingYdocToVideoDoc = true

    try {
      const ynode = event.target
      const id = ynode.get('id') as string
      const node = this.doc.nodes.get(id) as pub.AnyNode | undefined

      if (!node) return

      // apply property changes to node
      event.changes.keys.forEach((change, key) => {
        const newValue = change.action === 'delete' ? undefined : ynode.get(key)
        ;(node as Record<string, any>)[key] = newValue
      })
    } finally {
      this.#isSyncingYdocToVideoDoc = false
    }
  }

  #ensureObserved(ynode: Y.Map<unknown>): void {
    if (!OBSERVED.has(ynode)) {
      ynode.observe(this.#onYnodeChange)
      OBSERVED.add(ynode)
    }
  }

  #getOrCreateFromYnode(ynode: Y.Map<unknown>): pub.AnyNode {
    return (
      (this.doc.nodes.get(ynode.get('id') as string) as pub.AnyNode | undefined) ??
      this.doc.createNode(ynode.toJSON() as Schema.AnyNode)
    )
  }

  readonly #onYtreeChange = (): void => {
    this.#isSyncingYdocToVideoDoc = true
    try {
      this.ydoc.transact(() => this.#onYtreeChange_(TIMELINE_ID))
    } finally {
      this.#isSyncingYdocToVideoDoc = false
    }
  }

  #onYtreeChange_(parentKey: string): void {
    const ytree = this.#ytree

    const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(parentKey), parentKey)
    const childIdSet = new Set(childIds)

    // remove children that are no longer under the parent in the ytree
    ;(this.doc.nodes.get(parentKey) as Partial<pub.AnyParentNode> | undefined)?.children?.forEach(
      (child: pub.AnyNode) => {
        if (!childIdSet.has(child.id)) child.remove()
      },
    )

    childIds.forEach((nodeId, index) => {
      const ynode = this.#getYtreeNode(nodeId)
      const node = this.#getOrCreateFromYnode(ynode)

      this.#ensureObserved(ynode)

      if (
        (node.parent?.id ?? YTREE_ROOT_KEY) !== parentKey ||
        (parentKey !== YTREE_ROOT_KEY && node.index !== index)
      )
        node.move(parentKey === YTREE_ROOT_KEY ? undefined : { parentId: parentKey, index })

      this.#onYtreeChange_(nodeId)
    })
  }

  #onYtreeMapEvent(event: Y.YMapEvent<unknown>): void {
    this.#ytree.recomputeParentsAndChildren()

    event.changes.keys.forEach((change, key) => {
      switch (change.action) {
        case 'add':
          this.#getOrCreateFromYnode(this.#getYtreeNode(key))
          break
        case 'delete':
          ;(this.doc.nodes.get(key) as pub.AnyNode | undefined)?.delete()
          break
        case 'update':
          throw new Error(`Unexpected update to YTree map value at ${key}`)
      }
    })
  }

  #onSettingsUpdate({ from }: SettingsUpdateEvent): void {
    const udpates: Record<string, unknown> = {}

    for (const key in from)
      if (Object.hasOwn(from, key)) udpates[key] = this.doc[key as keyof DocumentSettings]

    updateYmap(this.settingsYmap, udpates)
  }

  #onNodeCreate({ node }: pub.NodeCreateEvent): void {
    const ytree = this.#ytree
    let ynode: Y.Map<unknown>

    try {
      ynode = this.#getYtreeNode(node.id)
    } catch {
      ynode = createYnodeFromJson(node.toJSON())
      ytree.createNode(node.parent?.id ?? YTREE_ROOT_KEY, node.id, ynode)
      ytree.recomputeParentsAndChildren()
    }

    this.#ensureObserved(ynode)
  }

  #onMove({ node }: NodeMoveEvent): void {
    const parentNode = node.parent
    const ytree = this.#ytree

    const parentKey = parentNode?.id ?? YTREE_ROOT_KEY
    if (ytree.getNodeParentFromKey(node.id) !== parentKey) {
      ytree.moveChildToParent(node.id, parentKey)
      // TODO: should be done by yjs-orderedtree
      ytree.recomputeParentsAndChildren()
    }

    if (parentNode) {
      const ytreeSiblingIds = new Set<string>(ytree.getNodeChildrenFromKey(parentKey))

      const nextId = node.next?.id
      const prevId = node.prev?.id

      if (nextId && ytreeSiblingIds.has(nextId)) ytree.setNodeBefore(node.id, nextId)
      else if (prevId && ytreeSiblingIds.has(prevId)) ytree.setNodeAfter(node.id, prevId)
    }
  }

  #onUpdate({ node, key, from }: NodeUpdateEvent): void {
    const ynode = this.#getYtreeNode(node.id)
    const prevNodeValue = from

    switch (key) {
      // effects are stored in YArrays although we only ever have one atm
      case 'effects': {
        const yeffects = ynode.get('effects') as Y.Array<Y.Map<unknown>>
        const firstEffect = node.effects.at(0)

        if (firstEffect) {
          let ymap = yeffects.get(0) as Y.Map<unknown> | undefined

          if (!ymap) {
            ymap = new Y.Map<unknown>()
            yeffects.insert(0, [ymap])
          }

          updateYmap(ymap, firstEffect)
        } else if (yeffects.length > 0) {
          yeffects.delete(0, Math.min(yeffects.length, 1))
        }

        break
      }
      // TODO:
      case 'markers':
        return
      // metadata is stored as a YMap of values
      case 'metadata': {
        const newMetadata = node.metadata ?? {}
        const metadataYmap = ynode.get('metadata') as Y.Map<unknown>

        updateYmap(metadataYmap, newMetadata)

        // delete properties that were removed from the metadata
        for (const key in prevNodeValue as typeof node.metadata) {
          if (!(key in newMetadata)) metadataYmap.delete(key)
        }

        break
      }
      // other properties are plain JSON values
      default:
        updateYmap(ynode, { [key]: node[key as keyof typeof node] })
    }
  }

  #onDelete({ node }: NodeDeleteEvent): void {
    this.#ytree.deleteNodeAndDescendants(node.id)
  }

  reset(): void {
    this.#yundo.clear()
  }

  generateId(): string {
    return this.#ytree.generateNodeKey()
  }

  /** @internal */
  serializeYdoc(): Omit<Schema.SerializedDocument, 'assets'> {
    const ytree = this.#ytree

    const serialize = <T extends Schema.AnyNodeSerializedSchema = Schema.AnyNodeSerializedSchema>(
      nodeId: string,
    ): T => {
      const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
      const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(nodeId), nodeId)

      return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
    }

    return {
      ...(this.settingsYmap.toJSON() as Schema.DocumentSettings),
      timeline: serialize(this.doc.timeline.id),
    }
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.#abort.abort()
    this.doc.dispose()
    this.#yundo.destroy()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }

  static initYmapFromJson = initYmapFromJson
}
