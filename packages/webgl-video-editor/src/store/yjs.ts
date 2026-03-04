import { ref } from 'fine-jsx'
import type { Size } from 'webgl-effects'
import * as Y from 'yjs'
import type { YTree } from 'yjs-orderedtree'

import type {
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  Schema,
  SettingsUpdateEvent,
} from 'webgl-video-editor'

import type * as pub from '../../types/core.d.ts'
import type { AnyNode, AnyParentNode, VideoEditorStore } from '../../types/core.d.ts'
import type { DocumentSettings } from '../../types/schema.d.ts'
import { DEFAULT_FRAMERATE, DEFAULT_RESOLUTION, TIMELINE_ID } from '../constants.ts'
import { NodeCreateEvent } from '../events.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'
import { createInitialDocument, getOrCreateYmap, initYjsRoot, initYmapFromJson } from './utils.ts'

const jsonValuesAreEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

const updateYmap = (ymap: Y.Map<unknown>, updates: Record<string, unknown>): void => {
  for (const key in updates) {
    if (Object.hasOwn(updates, key)) {
      const newValue = updates[key]
      if (!jsonValuesAreEqual(newValue, ymap.get(key))) ymap.set(key, newValue)
    }
  }
}

const OBSERVED = new WeakSet<Y.Map<unknown>>()

export class VideoEditorYjsStore implements VideoEditorStore {
  #doc!: pub.Document

  readonly ydoc: Y.Doc
  readonly settingsYmap: Y.Map<unknown>
  readonly #ytree!: YTree
  readonly #yundo!: Y.UndoManager
  readonly #ignoreOrigin = Symbol('ignore-undo')

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

  constructor(ymap: Y.Map<any>) {
    const treeYmap = getOrCreateYmap(ymap, YTREE_YMAP_KEY)
    const ydoc = treeYmap.doc!
    this.ydoc = ydoc

    ydoc.on('destroy', this.dispose.bind(this))

    {
      const { ytree, settings } = initYjsRoot(treeYmap)
      this.#ytree = ytree
      this.#yundo = new Y.UndoManager(treeYmap)
      this.settingsYmap = settings
    }
  }

  init(editor: pub.VideoEditor): void {
    let isNewDoc = true
    try {
      this.#ytree.getNodeValueFromKey(TIMELINE_ID)
      isNewDoc = false
    } catch {}

    const doc = (this.#doc = editor.doc)

    this.#ytree.observe(this.#onYtreeChange)


    doc.nodes.map.forEach((node) => this.#onNodeCreate(new NodeCreateEvent(node)))

    const bindNodeListener = <T extends unknown[]>(
      listener: (...args: T) => unknown,
    ): ((...args: T) => void) => {
      listener = listener.bind(this)
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

    if (isNewDoc) {
      doc.importFromJson(createInitialDocument())
    } else {
      const { settingsYmap } = this
      doc.resolution = (settingsYmap.get('resolution') as Size | undefined) ?? DEFAULT_RESOLUTION
      doc.frameRate = (settingsYmap.get('frameRate') as number | undefined) ?? DEFAULT_FRAMERATE
    }

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

  // TODO: shouldn't be needed
  untracked<T>(fn: () => T): T {
    return this.ydoc.transact(fn, this.#ignoreOrigin)
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
      const node = this.#doc.nodes.get(id) as AnyNode | undefined

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

  #getOrCreateFromYnode(ynode: Y.Map<unknown>): AnyNode {
    return (
      this.#doc.nodes.map.get(ynode.get('id') as string) ??
      this.#doc.createNode(ynode.toJSON() as Schema.AnyNodeSchema)
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

    // remove unparented nodes
    if (parentKey === YTREE_NULL_PARENT_KEY) {
      const unparentedIds: string[] = []
      ytree.getAllDescendants(YTREE_NULL_PARENT_KEY, unparentedIds)
      unparentedIds.forEach((nodeId) => this.#doc.nodes.map.get(nodeId)?.remove())
      return
    }

    const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(parentKey), parentKey)
    const childIdSet = new Set(childIds)

    // remove children that are no longer under the parent in the ytree
    ;(this.#doc.nodes.get(parentKey) as Partial<AnyParentNode> | undefined)?.children?.forEach(
      (child: AnyNode) => {
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

  #onSettingsUpdate({ from }: SettingsUpdateEvent): void {
    const udpates: Record<string, unknown> = {}

    for (const key in from)
      if (Object.hasOwn(from, key)) udpates[key] = this.#doc[key as keyof DocumentSettings]

    updateYmap(this.settingsYmap, udpates)
  }

  #onNodeCreate({ node }: pub.NodeCreateEvent): void {
    const ytree = this.#ytree
    let ynode: Y.Map<unknown>

    try {
      ynode = this.#getYtreeNode(node.id)
    } catch {
      ynode = new Y.Map(Object.entries(node.toObject()))
      ytree.createNode(YTREE_NULL_PARENT_KEY, node.id, ynode)
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

      if (nextId != null && ytreeSiblingIds.has(nextId)) ytree.setNodeBefore(node.id, nextId)
      else if (prevId != null && ytreeSiblingIds.has(prevId)) ytree.setNodeAfter(node.id, prevId)
    }
  }

  #onUpdate({ from, node }: NodeUpdateEvent): void {
    const udpates: Record<string, unknown> = {}

    for (const key in from) if (Object.hasOwn(from, key)) udpates[key] = node[key as keyof typeof node]

    updateYmap(this.#getYtreeNode(node.id), udpates)
  }

  #onDelete({ node }: NodeDeleteEvent): void {
    this.#ytree.moveChildToParent(node.id, YTREE_NULL_PARENT_KEY)
  }

  reset(): void {
    this.#yundo.clear()
  }

  dispose(): void {
    this.isDisposed = true
    this.#abort.abort()
  }

  generateId(): string {
    return this.#ytree.generateNodeKey()
  }

  /** @internal @hidden */
  serializeYdoc(): Omit<Schema.SerializedDocument, 'assets'> {
    const ytree = this.#ytree

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
    const serialize = <T extends Schema.AnyNodeSerializedSchema = Schema.AnyNodeSerializedSchema>(
      nodeId: string,
    ): T => {
      const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
      const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(nodeId), nodeId)

      return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
    }

    return {
      ...(this.settingsYmap.toJSON() as Schema.DocumentSettings),
      tracks: serialize<Schema.SerializedTimeline>(this.#doc.timeline.id).children,
    }
  }

  static initYmapFromJson = initYmapFromJson
}
