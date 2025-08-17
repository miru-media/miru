import 'virtual:uno.css'
/* eslint-disable import/no-extraneous-dependencies -- -- */
import '@unocss/reset/sanitize/sanitize.css'
import '@unocss/reset/sanitize/assets.css'
/* eslint-enable import/no-extraneous-dependencies -- -- */

import { ref } from 'fine-jsx'
import * as Y from 'yjs'
import { checkForYTree, YTree } from 'yjs-orderedtree'

import type {
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  Schema,
  VideoEditor,
  VideoEditorStore,
} from 'webgl-video-editor'
import { ASSET_TYPE_PREFIX, ROOT_NDOE_ID } from 'webgl-video-editor/vue'

import { INITIAL_DOC_UPDATE_BASE64, YTREE_ROOT_KEY, YTREE_YMAP_KEY } from './constants.ts'
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

  constructor(ydoc: Y.Doc) {
    this.ydoc = ydoc
    ydoc.on('destroy', this.dispose.bind(this))
  }

  init(editor: VideoEditor): void {
    this.untracked(() => this.#init(editor))
  }

  #init(editor: VideoEditor): void {
    const { _editor } = editor

    const ymap = this.ydoc.getMap(YTREE_YMAP_KEY)

    if (!checkForYTree(ymap)) {
      this.ydoc.transact(() => {
        Y.applyUpdate(
          this.ydoc,
          Uint8Array.from(atob(INITIAL_DOC_UPDATE_BASE64), (c) => c.charCodeAt(0)),
        )
      })
    }

    this.#ytree = new YTree(ymap)
    this.#yundo = new Y.UndoManager(ymap)
    this.#yundo.ignoreRemoteMapChanges = true

    const meta = this.ydoc.getMap<string>('meta')

    let isNewMovie = true
    try {
      this.#ytree.getNodeValueFromKey(ROOT_NDOE_ID)
      isNewMovie = false
    } catch {}

    const movie = (this.#movie = _editor._movie)
    movie.nodes.map.forEach((node) => this.#onCreate({ nodeId: node.id }))

    this.#ytree.observe(() => this.#onYtreeChange(YTREE_ROOT_KEY))

    const options: AddEventListenerOptions = { signal: this.#abort.signal }
    movie.on('node:create', this.#onCreate.bind(this), options)
    movie.on('node:move', this.#onMove.bind(this), options)
    movie.on('node:update', this.#onUpdate.bind(this), options)
    movie.on('node:delete', this.#onDelete.bind(this), options)
    movie.on('root:replace', this.reset.bind(this), options)

    if (isNewMovie) {
      editor.replaceContent(createInitialMovie(this.generateId.bind(this)))
      _editor.createInitialAssets()
    }

    this.#onYtreeChange(YTREE_ROOT_KEY)

    const onStackChange = () => {
      const yundo = this.#yundo
      this.#canUndo.value = yundo.canUndo()
      this.#canRedo.value = yundo.canRedo()
    }

    const yundo = this.#yundo
    yundo.on('stack-cleared', onStackChange)
    yundo.on('stack-item-added', onStackChange)
    yundo.on('stack-item-popped', onStackChange)
  }

  untracked<T>(fn: () => T): T {
    // WIP: set property on yundo to ignore all
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

  readonly #onYnodeChange = this.#onYnodeChange_.bind(this)
  #onYnodeChange_(event: Y.YMapEvent<unknown>): void {
    this.ydoc.transact(() => {
      const ynode = event.target
      const id = ynode.get('id') as string

      event.changes.keys.forEach((change, key) => {
        const node = this.#movie.nodes.get(id) as Record<string, any>
        const nodeValue = node[key]
        const newValue = change.action === 'delete' ? undefined : ynode.get(key)

        if (JSON.stringify(nodeValue) !== JSON.stringify(newValue)) node[key] = newValue
      })
    })
  }

  #ensureObserved(ynode: Y.Map<unknown>): void {
    if (!OBSERVED.has(ynode)) {
      ynode.observe(this.#onYnodeChange)
      OBSERVED.add(ynode)
    }
  }

  #onYtreeChange(parentKey: string) {
    this.ydoc.transact(() => {
      const ytree = this.#ytree
      const childIdArray: string[] = ytree.sortChildrenByOrder(
        ytree.getNodeChildrenFromKey(parentKey),
        parentKey,
      )
      const childIds = new Set<string>(childIdArray)

      const getOrCreateFromYTree = (ynode: Y.Map<unknown>) =>
        this.#movie.nodes.map.get(ynode.get('id') as string) ??
        this.#movie.createNode(ynode.toJSON() as Schema.AnyNodeSchema)

      if (parentKey === YTREE_ROOT_KEY) {
        childIdArray.forEach((nodeId) => {
          const ynode: Y.Map<unknown> = ytree.getNodeValueFromKey(nodeId)
          if ((ynode.get('type') as string).startsWith(ASSET_TYPE_PREFIX)) getOrCreateFromYTree(ynode)
        })
      } else {
        const node = this.#movie.nodes.get(parentKey)
        node.children?.forEach((child) => {
          if (!childIds.has(child.id)) child.remove()
        })
      }

      childIdArray.forEach((nodeId, index) => {
        const ynode = ytree.getNodeValueFromKey(nodeId)
        const node = getOrCreateFromYTree(ynode)

        this.#ensureObserved(ynode)

        if ((node.parent?.id ?? YTREE_ROOT_KEY) !== parentKey || node.index !== index)
          node.position(parentKey === YTREE_ROOT_KEY ? undefined : { parentId: parentKey, index })

        this.#onYtreeChange(nodeId)
      })
    })
  }

  #onCreate(event: Pick<NodeCreateEvent, 'nodeId'>): void {
    const { nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const ytree = this.#ytree
    let ynode: Y.Map<unknown>

    try {
      ynode = ytree.getNodeValueFromKey(nodeId)
    } catch {
      ynode = new Y.Map(Object.entries(node.toObject()))
      ynode.set('id', nodeId)
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

    try {
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
    } catch {}
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

    updateYnode(this.#ytree.getNodeValueFromKey(nodeId), udpates)
  }

  #onDelete(event: NodeDeleteEvent): void {
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
      const ynode: Y.Map<unknown> = ytree.getNodeValueFromKey(nodeId)
      const childIds: string[] = ytree.getNodeChildrenFromKey(nodeId)

      return { ...ynode.toJSON(), children: childIds.map(serialize) } as any
    }

    const movie = serialize(ytree.getNodeValueFromKey(ROOT_NDOE_ID)) as Schema.SerializedMovie

    return movie
  }
}
