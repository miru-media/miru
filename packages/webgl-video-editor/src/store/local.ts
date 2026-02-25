import { ref, watch } from 'fine-jsx'
import { uid } from 'uid'

import type * as core from '../../types/core'
import type { Schema } from '../../types/core'
import type { DocumentSettings } from '../../types/schema'
import type {
  AssetCreateEvent,
  AssetDeleteEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  SettingsUpdateEvent,
} from '../events.ts'
import type { PlaybackDocument } from '../playback-document.ts'
import { storage, type StorageFileWriteOptions } from '../storage/storage.ts'

import { createInitialDocument } from './utils.ts'

type HistoryOp<T extends core.Schema.AnyNodeSchema = core.Schema.AnyNodeSchema> =
  | { type: 'settings:update'; from: Partial<DocumentSettings>; to: Partial<DocumentSettings> }
  // TODO: remove group???!!!
  | { type: 'node:create'; group?: string; nodeId: string; init: core.Schema.AnyNodeSchema }
  | {
      type: 'node:move'
      group?: string
      nodeId: string
      from?: core.ChildNodePosition
      to?: core.ChildNodePosition
    }
  | {
      type: 'node:update'
      group?: string
      nodeId: string
      from: Partial<core.Schema.AnyNodeSchema>
      to: Partial<core.Schema.AnyNodeSchema>
    }
  | { type: 'node:delete'; group?: string; nodeId: string; from: T }

const LOCAL_STORAGE_PREFIX = 'video-editor:'

const patchObj = <T extends object>(obj: T, updates: Partial<T>): void => {
  for (const key in updates) if (Object.hasOwn(updates, key) && key in obj) obj[key] = updates[key]!
}

export class VideoEditorLocalStore implements core.VideoEditorStore {
  #doc!: PlaybackDocument
  readonly #actions: HistoryOp[][] = []
  #index = -1
  #pending?: HistoryOp[]
  #noTrack = 0
  readonly #canUndo = ref(false)
  readonly #canRedo = ref(false)

  readonly #DOC_CONTENT_KEY = `${LOCAL_STORAGE_PREFIX}content`
  readonly #ASSETS_KEY = `${LOCAL_STORAGE_PREFIX}assets`

  generateId = uid

  get canUndo(): boolean {
    return this.#canUndo.value
  }
  get canRedo(): boolean {
    return this.#canRedo.value
  }

  readonly #abort = new AbortController()
  readonly storage = storage

  init(editor: core.VideoEditor) {
    const doc = (this.#doc = editor._editor._doc)
    this.#restoreFromLocalStorage()

    // Persist to localStorage
    watch([() => editor.state], ([state]) =>
      localStorage.setItem(this.#DOC_CONTENT_KEY, JSON.stringify(state)),
    )

    const options: AddEventListenerOptions = { signal: this.#abort.signal }

    doc.on('settings:update', this.#onSettingsUpdate.bind(this), options)
    doc.on('asset:create', this.#onAssetCreate.bind(this), options)
    doc.on('asset:delete', this.#onAssetDelete.bind(this), options)
    doc.on('node:create', this.#onNodeCreate.bind(this), options)
    doc.on('node:move', this.#onMove.bind(this), options)
    doc.on('node:update', this.#onUpdate.bind(this), options)
    doc.on('node:delete', this.#onDelete.bind(this), options)

    this.#abort.signal.addEventListener('abort', this.reset.bind(this))
  }

  #restoreFromLocalStorage(): void {
    if (import.meta.env.SSR) return
    // restore document from localStorage
    const savedJson = localStorage.getItem(this.#DOC_CONTENT_KEY)
    let isRestored = false

    if (savedJson) {
      try {
        const parsed = JSON.parse(savedJson) as core.Schema.SerializedDocument

        this.#doc.importFromJson(parsed)
        isRestored = true
      } catch (error: unknown) {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}backup`, savedJson)
        const message = 'restore_failed'

        /* eslint-disable no-console, no-alert -- WIP */
        console.error(error)
        console.warn(message, savedJson)
        alert(message)
        /* eslint-enable no-console, no-alert */
      }
    }

    if (!isRestored) {
      this.#doc.importFromJson(createInitialDocument())
    }
  }

  untracked<T>(fn: () => T): T {
    this.#noTrack++
    const res = fn()

    if (res != null && typeof res === 'object' && 'then' in res)
      return Promise.resolve(res).finally(() => void this.#noTrack--) as T

    this.#noTrack--
    return res
  }

  transact<T>(fn: () => T): T {
    if (this.#pending) {
      return fn()
    }

    const ops = (this.#pending = [])
    const ret = fn()
    this.#pending = undefined
    if (ops.length) this.#add(ops)

    return ret
  }

  #add(ops: HistoryOp[]) {
    if (this.#noTrack) return

    if (this.#pending) {
      this.#pending.push(...ops)
      return
    }

    const actions = this.#actions

    if (ops.length === 1 && this.#canUndo.value) {
      const op = ops[0]
      const prevAction = actions[actions.length - 1]
      const prevOp = prevAction[prevAction.length - 1]

      if (
        op.type === 'node:update' &&
        op.type === prevOp.type &&
        op.nodeId === prevOp.nodeId &&
        op.group &&
        op.group === prevOp.group
      ) {
        Object.keys(op.to).forEach((key) => ((prevOp.to as any)[key] = op.to[key as keyof typeof op.to]))
        return
      }
    }
    actions.splice(this.#index + 1, Infinity, ops)

    this.#index++
    this.#canUndo.value = true
    this.#canRedo.value = false
  }

  #undoRedo(redo: boolean) {
    const actions = this.#actions

    if (redo) {
      if (!this.#canRedo.value) return
    } else if (!this.#canUndo.value) return

    const currentIndex = this.#index
    const newIndex = currentIndex + (redo ? 1 : -1)

    const ops = actions[redo ? newIndex : currentIndex]
    this.#index = newIndex

    const doc = this.#doc
    const { nodes } = doc

    this.untracked(() => {
      const orderedOps = redo ? ops : ops.slice().reverse()

      orderedOps.forEach((op) => {
        if (redo) {
          switch (op.type) {
            // update settings
            case 'settings:update':
              patchObj(this.#doc, op.to as any)
              break
            // create
            case 'node:create':
              doc.createNode(op.init)
              break
            // move
            case 'node:move': {
              const node = nodes.get(op.nodeId)
              const { to } = op
              if (node.parent?.id !== to?.parentId) node.remove()
              if (to) node.treePosition(to)
              break
            }
            // udpate
            case 'node:update':
              patchObj(nodes.get(op.nodeId), op.to as any)
              break
            // delete
            case 'node:delete':
              nodes.get(op.nodeId).dispose()
              break
          }
        } else {
          switch (op.type) {
            // revert settings udpate
            case 'settings:update':
              patchObj(this.#doc, op.from as any)
              break
            // delete created
            case 'node:create':
              nodes.get(op.nodeId).dispose()
              break
            // move back
            case 'node:move': {
              const node = nodes.get(op.nodeId)
              const { from } = op
              if (node.parent?.id !== from?.parentId) node.remove()
              if (from) node.treePosition(from)
              break
            }
            // revert udpate
            case 'node:update':
              patchObj(nodes.get(op.nodeId), op.from as any)
              break
            // recreate deleted
            case 'node:delete':
              doc.createNode(op.from)
              break
          }
        }
      })
    })

    this.#canUndo.value = newIndex > -1
    this.#canRedo.value = newIndex < actions.length - 1
  }

  undo(): void {
    this.#undoRedo(false)
  }
  redo(): void {
    this.#undoRedo(true)
  }

  #onSettingsUpdate({ from }: SettingsUpdateEvent): void {
    const to: Record<string, unknown> = {}

    for (const key in from) if (Object.hasOwn(from, key)) to[key] = this.#doc[key as keyof DocumentSettings]

    this.#add([{ type: 'settings:update', from, to }])
  }

  #onAssetCreate({ asset, source }: AssetCreateEvent) {
    const map = this.#getAssetMap()

    if (source != null && asset.type === 'asset:media:av')
      this.storage
        .getOrCreateFile(asset.id, source)
        .then(asset.setBlob.bind(asset))
        .catch(asset.setError.bind(asset))

    map[asset.id] = asset.toObject()
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify(map))
  }

  #onAssetDelete({ asset }: AssetDeleteEvent) {
    const map = this.#getAssetMap()

    map[asset.id] = undefined as never
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify(map))
  }

  #onNodeCreate({ node }: NodeCreateEvent): void {
    this.#add([{ type: 'node:create', nodeId: node.id, init: node.toObject() }])
  }
  #onMove({ node, from }: NodeMoveEvent): void {
    const to = node.parent && { parentId: node.parent.id, index: node.index }

    this.#add([{ type: 'node:move', nodeId: node.id, from, to }])
  }
  #onUpdate({ node, from }: NodeUpdateEvent): void {
    const to: Record<string, unknown> = {}

    for (const key in from) {
      if (Object.hasOwn(from, key)) {
        to[key] = node[key as keyof typeof node]
      }
    }

    this.#add([{ type: 'node:update', nodeId: node.id, from, to }])
  }
  #onDelete({ node }: NodeDeleteEvent): void {
    const { parent } = node
    const nodeId = node.id

    this.#add([
      { type: 'node:move', nodeId, from: parent && { parentId: parent.id, index: node.index } },
      { type: 'node:delete', nodeId, from: node.toObject() },
    ])
  }

  #getAssetMap(): Record<string, Schema.AnyAsset> {
    return JSON.parse(localStorage.getItem(this.#ASSETS_KEY) ?? '[]')
  }

  listFiles(): Array<Schema.AnyAsset> {
    try {
      return Object.values(this.#getAssetMap())
    } catch {
      return []
    }
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
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify({ ...this.#getAssetMap(), [asset.id]: asset }))
  }

  async getFile(key: string, name?: string, options?: FilePropertyBag): Promise<File> {
    return await this.storage.getFile(key, name, options)
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key)
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify(this.listFiles().filter((a) => a.id !== key)))
  }

  reset(): void {
    this.#actions.length = 0
    this.#index = -1
    this.#canRedo.value = this.#canUndo.value = false
  }

  dispose() {
    this.#abort.abort()
  }
}
