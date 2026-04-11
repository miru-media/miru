import { ref, watch } from 'fine-jsx'
import { uid } from 'uid'

import { FileSystemAssetStore } from '#assets'
import type { KeyofUnion } from '#internal'

import type * as core from '../../types/core.d.ts'
import type { Schema } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'
import { Document } from '../document.ts'
import type {
  AssetCreateEvent,
  AssetDeleteEvent,
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
  SettingsUpdateEvent,
} from '../events.ts'

import { createInitialDocument } from './utils.ts'

const HISTORY_BATCH_MS = 200

type HistoryOp =
  | {
      type: 'settings:update'
      from: Partial<Schema.DocumentSettings>
      to: Partial<Schema.DocumentSettings>
    }
  | { type: 'node:create'; nodeId: string; init: Schema.AnyNode }
  | {
      type: 'node:move'
      nodeId: string
      from?: core.ChildNodePosition
      to?: core.ChildNodePosition
    }
  | {
      type: 'node:update'
      nodeId: string
      key: KeyofUnion<Schema.AnyNode>
      from: any
      to: any
    }
  | { type: 'node:delete'; nodeId: string; from: Schema.AnyNode }

const LOCAL_STORAGE_PREFIX = 'video-editor:'

const patchObj = <T extends object>(obj: T, updates: Partial<T>): void => {
  for (const key in updates) if (Object.hasOwn(updates, key) && key in obj) obj[key] = updates[key]!
}

class HistoryAction extends Array<HistoryOp> {
  timestamp = Date.now()
}

export class LocalSync implements core.VideoEditorDocumentSync {
  doc!: pub.Document
  readonly #actions: HistoryAction[] = []
  #index = -1
  #pending?: HistoryOp[]
  #noTrack = 0
  readonly #canUndo = ref(false)
  readonly #canRedo = ref(false)

  readonly #DOC_CONTENT_KEY = `${LOCAL_STORAGE_PREFIX}content`
  readonly #ASSETS_KEY = `${LOCAL_STORAGE_PREFIX}assets`

  generateId = uid
  isDisposed = false

  get canUndo(): boolean {
    return this.#canUndo.value
  }
  get canRedo(): boolean {
    return this.#canRedo.value
  }

  readonly #abort = new AbortController()

  constructor(assets = new FileSystemAssetStore()) {
    const doc = (this.doc = new Document({ assets }))
    this.#restoreFromLocalStorage()

    // Persist to localStorage
    watch([() => doc.toJSON()], ([state]) =>
      localStorage.setItem(this.#DOC_CONTENT_KEY, JSON.stringify(state)),
    )

    const options: AddEventListenerOptions = { signal: this.#abort.signal }

    doc.on('doc:dispose', this.dispose.bind(this), options)
    doc.on('settings:update', this.#onSettingsUpdate.bind(this), options)
    doc.on('asset:create', this.#onAssetCreate.bind(this), options)
    doc.on('asset:delete', this.#onAssetDelete.bind(this), options)
    doc.on('node:create', this.#onNodeCreate.bind(this), options)
    doc.on('node:move', this.#onMove.bind(this), options)
    doc.on('node:update', this.#onUpdate.bind(this), options)
    doc.on('node:delete', this.#onDelete.bind(this), options)
  }

  #restoreFromLocalStorage(): void {
    if (import.meta.env.SSR) return
    // restore document from localStorage
    const savedJson = localStorage.getItem(this.#DOC_CONTENT_KEY)
    const content = savedJson
      ? (JSON.parse(savedJson) as core.Schema.SerializedDocument)
      : createInitialDocument()

    // update ndoes with old 'clip' type
    content.timeline.children.forEach(({ trackType, children }) =>
      children.forEach((node) => {
        if ((node.type as string) === 'clip') node.type = `clip:${trackType}`
      }),
    )

    this.doc.importFromJson(content)
  }

  #untracked<T>(fn: () => T): T {
    this.#noTrack += 1
    const res = fn()

    if (res != null && typeof res === 'object' && 'then' in res)
      return Promise.resolve(res).finally(() => void (this.#noTrack -= 1)) as T

    this.#noTrack -= 1
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
    const lastAction = actions[this.#index]

    if (this.canUndo && Date.now() - lastAction.timestamp < HISTORY_BATCH_MS) {
      lastAction.push(...ops)
      actions.splice(this.#index + 1, Infinity)
    } else {
      actions.splice(this.#index + 1, Infinity, new HistoryAction(...ops))
      this.#index += 1
      this.#canUndo.value = true
      this.#canRedo.value = false
    }
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

    const { doc } = this
    const { nodes } = doc

    this.#untracked(() => {
      const orderedOps = redo ? ops : ops.slice().reverse()

      orderedOps.forEach((op) => {
        if (redo) {
          switch (op.type) {
            // update settings
            case 'settings:update':
              patchObj(this.doc, op.to as any)
              break
            // create
            case 'node:create':
              doc.createNode(op.init)
              break
            // move
            case 'node:move': {
              const node = nodes.get(op.nodeId)
              const { to } = op
              node.remove()
              if (to) node.move(to)
              break
            }
            // udpate
            case 'node:update':
              ;(nodes.get(op.nodeId) as unknown as Record<string, unknown>)[op.key] = op.to
              break
            // delete
            case 'node:delete':
              nodes.get(op.nodeId).delete()
              break
          }
        } else {
          switch (op.type) {
            // revert settings udpate
            case 'settings:update':
              patchObj(this.doc, op.from as any)
              break
            // delete created
            case 'node:create':
              nodes.get(op.nodeId).delete()
              break
            // move back
            case 'node:move': {
              const node = nodes.get(op.nodeId)
              const { from } = op
              node.remove()
              if (from) node.move(from)

              break
            }
            // revert udpate
            case 'node:update':
              ;(nodes.get(op.nodeId) as unknown as Record<string, unknown>)[op.key] = op.from
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

    for (const key in from)
      if (Object.hasOwn(from, key)) to[key] = this.doc[key as keyof Schema.DocumentSettings]

    this.#add([{ type: 'settings:update', from, to }])
  }

  #onAssetCreate({ asset }: AssetCreateEvent) {
    const map = this.#getAssetMap()

    map[asset.id] = asset.toJSON()
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify(map))
  }

  #onAssetDelete({ asset }: AssetDeleteEvent) {
    const map = this.#getAssetMap()

    map[asset.id] = undefined as never
    localStorage.setItem(this.#ASSETS_KEY, JSON.stringify(map))
  }

  #onNodeCreate({ node }: NodeCreateEvent): void {
    this.#add([{ type: 'node:create', nodeId: node.id, init: node.toJSON() }])
  }
  #onMove({ node, from }: NodeMoveEvent): void {
    const to = node.parent && { parentId: node.parent.id, index: node.index }

    this.#add([{ type: 'node:move', nodeId: node.id, from, to }])
  }
  #onUpdate({ node, key, from }: NodeUpdateEvent): void {
    const to = node[key as keyof typeof node]

    this.#add([{ type: 'node:update', nodeId: node.id, key, from, to }])
  }
  #onDelete({ node }: NodeDeleteEvent): void {
    const { parent } = node
    const nodeId = node.id

    this.#add([
      { type: 'node:move', nodeId, from: parent && { parentId: parent.id, index: node.index } },
      { type: 'node:delete', nodeId, from: node.toJSON() as Schema.AnyNode },
    ])
  }

  #getAssetMap(): Record<string, Schema.AnyAssetSchema> {
    return JSON.parse(localStorage.getItem(this.#ASSETS_KEY) ?? '[]')
  }

  reset(): void {
    this.#actions.length = 0
    this.#index = -1
    this.#canRedo.value = this.#canUndo.value = false
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this.#abort.abort()
    this.doc.dispose()
  }
}
