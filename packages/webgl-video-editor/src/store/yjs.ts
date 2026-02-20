import { ref } from 'fine-jsx'
import type { Size } from 'webgl-effects'
import * as Y from 'yjs'
import { YTree } from 'yjs-orderedtree'

import type {
  AssetDeleteEvent,
  AssetRefreshEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  Schema,
  VideoEditor,
  VideoEditorStore,
} from 'webgl-video-editor'

import type { AnyNode, AnyParentNode } from '../../types/internal'
import { ROOT_NODE_ID } from '../constants.ts'
import { AssetCreateEvent, NodeCreateEvent } from '../events.ts'
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
  readonly assetsYmap: Y.Map<Schema.AnyAsset>
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
    this.assetsYmap = assetsYmap as Y.Map<Schema.AnyAsset>

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
      this.#onAssetCreate(new AssetCreateEvent(asset, 'url' in asset.raw ? asset.raw.url : undefined)),
    )
    movie.nodes.map.forEach((node) => this.#onNodeCreate(new NodeCreateEvent(node)))

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
    movie.on('node:create', bindNodeListener(this.#onNodeCreate), options)
    movie.on('node:move', bindNodeListener(this.#onMove), options)
    movie.on('node:update', bindNodeListener(this.#onUpdate), options)
    movie.on('node:delete', bindNodeListener(this.#onDelete), options)
    movie.on('asset:create', bindNodeListener(this.#onAssetCreate), options)
    movie.on('asset:delete', bindNodeListener(this.#onAssetDelete), options)
    movie.on('asset:refresh', bindNodeListener(this.#onAssetRefresh), options)
    /* eslint-enable @typescript-eslint/unbound-method */

    if (isNewMovie) {
      movie.importFromJson(createInitialMovie())
    } else {
      const movieYnode = this.#getYtreeNode(ROOT_NODE_ID)
      movie.resolution = movieYnode.get('resolution') as Size
      movie.frameRate = movieYnode.get('frameRate') as number
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
    ;(this.#movie.nodes.get(parentKey) as Partial<AnyParentNode> | undefined)?.children?.forEach(
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
        node.position(parentKey === YTREE_ROOT_KEY ? undefined : { parentId: parentKey, index })

      this.#onYtreeChange_(nodeId)
    })
  }

  #onNodeCreate({ node }: NodeCreateEvent): void {
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

    for (const key in from) {
      if (Object.hasOwn(from, key)) {
        udpates[key] = node[key as keyof typeof node]
      }
    }

    updateYnode(this.#getYtreeNode(node.id), udpates)
  }

  #onDelete({ node }: NodeDeleteEvent): void {
    this.#ytree.moveChildToParent(node.id, YTREE_NULL_PARENT_KEY)
  }

  #onAssetCreate({ asset, source }: AssetCreateEvent): void {
    const ymap = this.assetsYmap

    if (asset.type === 'asset:media:av') {
      this.storage
        .getOrCreateFile(asset.id, source)
        .then(asset.setBlob.bind(asset))
        .catch(asset.setError.bind(asset))
    }

    if (!ymap.get(asset.id)) ymap.set(asset.id, asset.toObject())
  }

  async #onAssetRefresh({ asset }: AssetRefreshEvent): Promise<void> {
    if (!(await this.storage.hasCompleteFile(asset.id)))
      throw new Error(`[webgl-video-editor] couldn't get asset data from storage (${asset.id})`)

    const blob = await storage.getFile(asset.id)
    asset.setBlob(blob)
  }

  #onAssetDelete({ asset }: AssetDeleteEvent): void {
    this.assetsYmap.delete(asset.id)
  }

  listFiles(): Iterable<Schema.AnyAsset> {
    return this.assetsYmap.values()
  }

  async hasCompleteFile(key: string): Promise<boolean> {
    return await this.storage.hasCompleteFile(key)
  }

  async createFile(
    asset: Schema.AnyAsset,
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
