import { ref } from 'fine-jsx'
import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type {
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  Schema,
  VideoEditor,
  VideoEditorStore,
} from 'webgl-video-editor'

import type { AnyNode } from '../../types/internal'
import { ROOT_NODE_ID } from '../constants.ts'
import type { BaseNode } from '../nodes/base-node.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'
import { createInitialMovie } from './utils.ts'

const updateYnode = (ynode: Y.Map<unknown>, updates: Partial<Schema.AnyNodeSchema>): void => {
  for (const key in updates) {
    if (Object.hasOwn(updates, key)) {
      const newValue = updates[key as keyof Schema.AnyNodeSchema]
      if (JSON.stringify(newValue) !== JSON.stringify(ynode.get(key))) ynode.set(key, newValue)
    }
  }
}

const OBSERVED = new WeakSet<Y.Map<unknown>>()

const getOrCreateYmap = <T>(ymap: Y.Map<unknown>, key: string): Y.Map<T> => {
  let newYmap = (ymap as Y.Map<Y.Map<T>>).get(key)

  if (!newYmap) {
    newYmap = new Y.Map()
    ymap.set(key, newYmap)
  }

  return newYmap
}

export class VideoEditorYjsStore implements VideoEditorStore {
  #movie!: VideoEditor['_editor']['_movie']

  readonly ydoc: Y.Doc
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

  #isSyncingYdocToMovie = false
  get #shouldSkipNodeEvent(): boolean {
    return this.#yundo.undoing || this.#yundo.redoing || this.#isSyncingYdocToMovie
  }

  constructor(ymap: Y.Map<unknown>) {
    const ydoc = ymap.doc!
    this.ydoc = ydoc
    ydoc.on('destroy', this.dispose.bind(this))

    const ytreeMap = getOrCreateYmap<unknown>(ymap, YTREE_YMAP_KEY)

    this.#ytree = new YTree(ytreeMap)
    this.#yundo = new Y.UndoManager(ymap)
  }

  init(editor: VideoEditor): void {
    const { _editor } = editor

    let isNewMovie = true
    try {
      this.#ytree.getNodeValueFromKey(ROOT_NODE_ID)
      isNewMovie = false
    } catch {}

    const movie = (this.#movie = _editor._movie)
    movie.nodes.map.forEach((node) => this.#onCreate({ nodeId: node.id }))

    this.#ytree.observe(this.#onYtreeChange)

    const bindNodeListener = <T extends unknown[]>(
      listener: (...args: T) => unknown,
    ): ((...args: T) => void) => {
      listener = listener.bind(this)
      return (...args) => {
        if (!this.#shouldSkipNodeEvent) this.transact(() => listener(...args))
      }
    }

    const options: AddEventListenerOptions = { signal: this.#abort.signal }
    /* eslint-disable @typescript-eslint/unbound-method -- false positive */
    movie.on('node:create', bindNodeListener(this.#onCreate), options)
    movie.on('node:move', bindNodeListener(this.#onMove), options)
    movie.on('node:update', bindNodeListener(this.#onUpdate), options)
    movie.on('node:delete', bindNodeListener(this.#onDelete), options)
    /* eslint-enable @typescript-eslint/unbound-method */

    if (isNewMovie) {
      editor.replaceContent(createInitialMovie(this.generateId.bind(this)))
      _editor.createInitialAssets()
    }

    movie.on('root:replace', this.reset.bind(this), options)
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
    this.#isSyncingYdocToMovie = true

    try {
      const ynode = event.target
      const id = ynode.get('id') as string
      const node = this.#movie.nodes.get(id) as AnyNode | undefined

      if (!node) return

      // apply property changes to node
      event.changes.keys.forEach((change, key) => {
        const newValue = change.action === 'delete' ? undefined : ynode.get(key)
        ;(node as Record<string, any>)[key] = newValue
      })
    } finally {
      this.#isSyncingYdocToMovie = false
    }
  }

  #ensureObserved(ynode: Y.Map<unknown>): void {
    if (!OBSERVED.has(ynode)) {
      ynode.observe(this.#onYnodeChange)
      OBSERVED.add(ynode)
    }
  }

  #getOrCreateFromYnode(ynode: Y.Map<unknown>): BaseNode {
    return (
      this.#movie.nodes.map.get(ynode.get('id') as string) ??
      this.#movie.createNode(ynode.toJSON() as Schema.AnyNodeSchema)
    )
  }

  readonly #onYtreeChange = (): void => {
    this.#isSyncingYdocToMovie = true
    try {
      this.ydoc.transact(() => this.#onYtreeChange_(ROOT_NODE_ID))
    } finally {
      this.#isSyncingYdocToMovie = false
    }
  }

  #onYtreeChange_(parentKey: string): void {
    const ytree = this.#ytree

    // remove unparented nodes
    if (parentKey === YTREE_NULL_PARENT_KEY) {
      const unparentedIds: string[] = []
      ytree.getAllDescendants(YTREE_NULL_PARENT_KEY, unparentedIds)
      unparentedIds.forEach((nodeId) => this.#movie.nodes.map.get(nodeId)?.remove())
      return
    }

    const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(parentKey), parentKey)
    const childIdSet = new Set(childIds)

    // remove children that are no longer under the parent in the ytree
    ;(this.#movie.nodes.get(parentKey) as AnyNode | undefined)?.children?.forEach((child) => {
      if (!childIdSet.has(child.id)) child.remove()
    })

    childIds.forEach((nodeId, index) => {
      const ynode = this.#getYtreeNode(nodeId)
      const node = this.#getOrCreateFromYnode(ynode)

      this.#ensureObserved(ynode)

      if (
        (node.parent?.id ?? YTREE_ROOT_KEY) !== parentKey ||
        (parentKey !== YTREE_ROOT_KEY && node.index !== index)
      )
        node.position(parentKey === YTREE_ROOT_KEY ? undefined : { parentId: parentKey, index })

      this.#onYtreeChange_(nodeId)
    })
  }

  #onCreate(event: Pick<NodeCreateEvent, 'nodeId'>): void {
    const { nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const ytree = this.#ytree
    let ynode: Y.Map<unknown>

    try {
      ynode = this.#getYtreeNode(nodeId)
    } catch {
      ynode = new Y.Map(Object.entries(node.toObject()))
      ytree.createNode(YTREE_NULL_PARENT_KEY, nodeId, ynode)
      ytree.recomputeParentsAndChildren()
    }

    this.#ensureObserved(ynode)
  }

  #onMove(event: NodeMoveEvent): void {
    const { nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const parentNode = node.parent
    const ytree = this.#ytree

    const parentKey = parentNode?.id ?? YTREE_ROOT_KEY
    if (ytree.getNodeParentFromKey(nodeId) !== parentKey) {
      ytree.moveChildToParent(nodeId, parentKey)
      // TODO: should be done by yjs-orderedtree
      ytree.recomputeParentsAndChildren()
    }

    if (parentNode) {
      const ytreeSiblingIds = new Set<string>(ytree.getNodeChildrenFromKey(parentKey))

      const nextId = node.next?.id
      const prevId = node.prev?.id

      if (nextId && ytreeSiblingIds.has(nextId)) ytree.setNodeBefore(nodeId, nextId)
      else if (prevId && ytreeSiblingIds.has(prevId)) ytree.setNodeAfter(nodeId, prevId)
    }
  }

  #onUpdate(event: NodeUpdateEvent): void {
    const { from, nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const udpates: Record<string, unknown> = {}

    for (const key in from) {
      if (Object.hasOwn(from, key)) {
        udpates[key] = node[key as keyof typeof node]
      }
    }

    updateYnode(this.#getYtreeNode(nodeId), udpates)
  }

  #onDelete(event: NodeDeleteEvent): void {
    const { nodeId } = event

    this.#ytree.moveChildToParent(nodeId, YTREE_NULL_PARENT_KEY)
  }

  reset(): void {
    this.#yundo.clear()
  }

  dispose(): void {
    this.#abort.abort()
  }

  generateId(): string {
    return this.#ytree.generateNodeKey()
  }

  serializeYdoc() {
    const ytree = this.#ytree

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- false positive
    const serialize = <T extends Schema.AnyNodeSerializedSchema = Schema.AnyNodeSerializedSchema>(
      nodeId: string,
    ): T => {
      const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
      const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(nodeId), nodeId)

      return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
    }

    const movie = this.#movie

    return {
      ...this.#movie.toObject(),
      assets: movie.assetLibrary.children.map((asset) =>
        serialize<Schema.VideoEffectAsset | Schema.AvMediaAsset>(asset.id),
      ),
      tracks: movie.assetLibrary.children.map((track) => serialize<Schema.SerializedTrack>(track.id)),
    }
  }
}
