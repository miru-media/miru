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

import { ASSET_TYPE_PREFIX, ROOT_NDOE_ID } from '../constants.ts'

import { YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'
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

export class VideoEditorYjsStore implements VideoEditorStore {
  #movie!: VideoEditor['_editor']['_movie']

  readonly ydoc: Y.Doc
  #ytree!: YTree
  #yundo!: Y.UndoManager
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

  #isApplyingDocUpdate = false
  get #shouldSkipNodeEvent(): boolean {
    return this.#yundo.undoing || this.#yundo.redoing || this.#isApplyingDocUpdate
  }

  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc
    ydoc.on('destroy', this.dispose.bind(this))
  }

  init(editor: VideoEditor): void {
    const { _editor } = editor

    const ymap = this.ydoc.getMap(YTREE_YMAP_KEY)

    this.#ytree = new YTree(ymap)
    const yundo = (this.#yundo = new Y.UndoManager(ymap))

    let isNewMovie = true
    try {
      this.#ytree.getNodeValueFromKey(ROOT_NDOE_ID)
      isNewMovie = false
    } catch {}

    const movie = (this.#movie = _editor._movie)
    movie.nodes.map.forEach((node) => this.#onCreate({ nodeId: node.id }))

    this.#ytree.observe(this.#onYtreeChange.bind(this))

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

    yundo.ignoreRemoteMapChanges = true
    yundo.on('stack-cleared', onStackChange)
    yundo.on('stack-item-added', onStackChange)
    yundo.on('stack-item-popped', onStackChange)
    yundo.clear()
  }

  // WIP: shouldn't be needed
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

  readonly #onYnodeChange = (event: Y.YMapEvent<unknown>): void => {
    this.#isApplyingDocUpdate = true

    try {
      this.ydoc.transact(() => {
        const ynode = event.target
        const id = ynode.get('id') as string
        const node = this.#movie.nodes.get(id) as Record<string, any>

        event.changes.keys.forEach((change, key) => {
          const newValue = change.action === 'delete' ? undefined : ynode.get(key)
          node[key] = newValue
        })
      })
    } finally {
      this.#isApplyingDocUpdate = false
    }
  }

  #ensureObserved(ynode: Y.Map<unknown>): void {
    if (!OBSERVED.has(ynode)) {
      ynode.observe(this.#onYnodeChange)
      OBSERVED.add(ynode)
    }
  }

  #onYtreeChange(): void {
    this.#isApplyingDocUpdate = true
    try {
      this.ydoc.transact(() => this.#onYtreeChange_(YTREE_ROOT_KEY))
    } finally {
      this.#isApplyingDocUpdate = false
    }
  }

  #onYtreeChange_(parentKey: string): void {
    const ytree = this.#ytree
    const childIds: string[] = ytree.sortChildrenByOrder(ytree.getNodeChildrenFromKey(parentKey), parentKey)
    const childIdSet = new Set<string>(childIds)

    const getOrCreateFromYTree = (ynode: Y.Map<unknown>) =>
      this.#movie.nodes.map.get(ynode.get('id') as string) ??
      this.#movie.createNode(ynode.toJSON() as Schema.AnyNodeSchema)

    if (parentKey === YTREE_ROOT_KEY) {
      childIds.forEach((nodeId) => {
        const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
        if ((ynode.get('type') as string).startsWith(ASSET_TYPE_PREFIX)) getOrCreateFromYTree(ynode)
      })
    } else {
      this.#movie.nodes.get(parentKey).children?.forEach((child) => {
        if (!childIdSet.has(child.id)) child.remove()
      })
    }

    childIds.forEach((nodeId, index) => {
      const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
      const node = getOrCreateFromYTree(ynode)

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
      ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
    } catch {
      ynode = new Y.Map(Object.entries(node.toObject()))
      ytree.createNode(YTREE_ROOT_KEY, nodeId, ynode)
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
    if (ytree.getNodeParentFromKey(nodeId) !== parentKey) ytree.moveChildToParent(nodeId, parentKey)

    if (parentNode) {
      const ytreeSiblingIds = new Set<string>(ytree.getNodeChildrenFromKey(parentKey))

      ytree.recomputeParentsAndChildren()
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

    updateYnode(this.#ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>, udpates)
  }

  #onDelete(event: NodeDeleteEvent): void {
    if (this.#shouldSkipNodeEvent) return

    const { nodeId } = event

    this.#ytree.deleteNodeAndDescendants(nodeId)
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

  serializeYdoc(): Schema.SerializedMovie {
    const ytree = this.#ytree

    const serialize = (nodeId: string): Schema.AnyNodeSerializedSchema => {
      const ynode = ytree.getNodeValueFromKey(nodeId) as Y.Map<unknown>
      const childIds: string[] = ytree.getNodeChildrenFromKey(nodeId)

      return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
    }

    const movie = serialize(ytree.getNodeValueFromKey(ROOT_NDOE_ID) as string) as Schema.SerializedMovie

    return movie
  }
}
