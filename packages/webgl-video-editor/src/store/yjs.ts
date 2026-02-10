import { ref } from 'fine-jsx'
import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type {
  AssetCreateEvent,
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
import { storage } from '../storage/index.ts'
import type { StorageFileWriteOptions } from '../storage/storage.ts'

import { YTREE_NULL_PARENT_KEY, YTREE_ROOT_KEY } from './constants.ts'
import { createInitialMovie, initYmapsFromJson } from './utils.ts'

const jsonValuesAreEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

const updateYnode = (ynode: Y.Map<unknown>, updates: Partial<Schema.AnyNodeSchema>): void => {
  for (const key in updates) {
    if (Object.hasOwn(updates, key)) {
      const newValue = updates[key as keyof Schema.AnyNodeSchema]
      if (!jsonValuesAreEqual(newValue, ynode.get(key))) ynode.set(key, newValue)
    }
  }
}

const OBSERVED = new WeakSet<Y.Map<unknown>>()

export class VideoEditorYjsStore implements VideoEditorStore {
  #movie!: VideoEditor['_editor']['_movie']

  readonly ydoc: Y.Doc
  readonly assetsYmap: Y.Map<Schema.Asset>
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
  readonly storage = storage

  #isSyncingYdocToMovie = false
  get #shouldSkipNodeEvent(): boolean {
    return this.#yundo.undoing || this.#yundo.redoing || this.#isSyncingYdocToMovie
  }

  constructor(treeYmap: Y.Map<unknown>, assetsYmap: Y.Map<unknown>) {
    const ydoc = treeYmap.doc!
    this.ydoc = ydoc
    this.assetsYmap = assetsYmap as Y.Map<Schema.Asset>

    ydoc.on('destroy', this.dispose.bind(this))

    this.#ytree = new YTree(treeYmap)
    this.#yundo = new Y.UndoManager([treeYmap, assetsYmap])

    try {
      this.#ytree.getNodeValueFromKey(YTREE_NULL_PARENT_KEY)
    } catch {
      this.#ytree.createNode(YTREE_ROOT_KEY, YTREE_NULL_PARENT_KEY, {})
    }
  }

  init(editor: VideoEditor): void {
    const { _editor } = editor

    let isNewMovie = true
    try {
      this.#ytree.getNodeValueFromKey(ROOT_NODE_ID)
      isNewMovie = false
    } catch {}

    const movie = (this.#movie = _editor._movie)

    this.#ytree.observe(this.#onYtreeChange)

    movie.assets.forEach((asset) =>
      this.#onAssetCreate({ assetId: asset.id, source: 'raw' in asset ? asset.raw.url : undefined }),
    )
    movie.nodes.map.forEach((node) => this.#onNodeCreate({ nodeId: node.id }))

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
    movie.on('asset:create', bindNodeListener(this.#onAssetCreate), options)
    movie.on('node:create', bindNodeListener(this.#onNodeCreate), options)
    movie.on('node:move', bindNodeListener(this.#onMove), options)
    movie.on('node:update', bindNodeListener(this.#onUpdate), options)
    movie.on('node:delete', bindNodeListener(this.#onDelete), options)
    /* eslint-enable @typescript-eslint/unbound-method */

    if (isNewMovie) {
      movie.importFromJson(createInitialMovie())
    }

    this.assetsYmap.forEach((asset) => {
      if (!movie.assets.has(asset.id)) movie.createAsset(asset)
    })
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

  #onAssetCreate({ assetId, source }: Pick<AssetCreateEvent, 'assetId' | 'source'>) {
    const ymap = this.assetsYmap
    const asset = this.#movie.assets.get(assetId)!

    if (source != null && asset.type === 'asset:media:av') {
      this.storage
        .getOrCreateFile(asset.id, source)
        .then(asset.setBlob.bind(asset))
        .catch(asset.setError.bind(asset))
    }

    if (!ymap.get(assetId)) ymap.set(assetId, asset.toObject())
  }

  #onNodeCreate(event: Pick<NodeCreateEvent, 'nodeId'>): void {
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

  listFiles(): Iterable<Schema.Asset> {
    return this.assetsYmap.values()
  }

  async hasCompleteFile(key: string): Promise<boolean> {
    return await this.storage.hasCompleteFile(key)
  }

  async createFile(
    asset: Schema.Asset,
    stream: ReadableStream<Uint8Array>,
    options: StorageFileWriteOptions,
  ): Promise<void> {
    const key = asset.id
    await this.storage.fromStream(key, stream, options)
    this.assetsYmap.set(key, asset)
  }

  async getFile(key: string, name?: string, options?: FilePropertyBag): Promise<File> {
    return await this.storage.getFile(key, name, options)
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key)
    this.assetsYmap.delete(key)
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

  /** @internal @hidden */
  serializeYdoc(): Schema.SerializedMovie {
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
      assets: Array.from(this.assetsYmap.values()),
      tracks: movie.timeline.children.map((track) => serialize<Schema.SerializedTrack>(track.id)),
    }
  }

  static initYmapsFromJson = initYmapsFromJson
}
