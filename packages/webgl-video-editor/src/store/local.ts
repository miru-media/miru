import { ref, watch } from 'fine-jsx'
import { uid } from 'uid'

import type * as core from '../../types/core'
import type { NodeCreateEvent, NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from '../events.ts'
import type { Movie } from '../nodes/movie.ts'
import type { ParentNode } from '../nodes/parent-node.ts'

import { createInitialMovie } from './utils.ts'

type HistoryOp<T extends core.Schema.AnyNodeSchema = core.Schema.AnyNodeSchema> =
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
const MOVIE_CONTENT_KEY = `${LOCAL_STORAGE_PREFIX}content`

export class VideoEditorLocalStore implements core.VideoEditorStore {
  #movie!: Movie
  readonly #actions: HistoryOp[][] = []
  #index = -1
  #pending?: HistoryOp[]
  #noTrack = 0
  readonly #canUndo = ref(false)
  readonly #canRedo = ref(false)

  generateId = uid

  get canUndo(): boolean {
    return this.#canUndo.value
  }
  get canRedo(): boolean {
    return this.#canRedo.value
  }

  readonly #abort = new AbortController()

  init(editor: core.VideoEditor) {
    this.#restoreFromLocalStorage(editor)

    const movie = (this.#movie = editor._editor._movie)

    // Persist to localStorage
    watch([() => editor.state], ([state]) => localStorage.setItem(MOVIE_CONTENT_KEY, JSON.stringify(state)))

    const options: AddEventListenerOptions = { signal: this.#abort.signal }

    movie.on('node:create', this.#onCreate.bind(this), options)
    movie.on('node:move', this.#onMove.bind(this), options)
    movie.on('node:update', this.#onUpdate.bind(this), options)
    movie.on('node:delete', this.#onDelete.bind(this), options)
    movie.on('root:replace', this.reset.bind(this), options)

    this.#abort.signal.addEventListener('abort', this.reset.bind(this))
  }

  #restoreFromLocalStorage(editor: core.VideoEditor) {
    if (import.meta.env.SSR) return
    // restore movie from localStorage
    const savedJson = localStorage.getItem(MOVIE_CONTENT_KEY)
    let isRestored = false

    if (savedJson) {
      try {
        const parsed = JSON.parse(savedJson) as core.Schema.SerializedMovie

        editor.replaceContent(parsed)
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
      editor.replaceContent(createInitialMovie(() => this.generateId()))
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
      const { nodeId, group, type } = op
      const prevAction = actions[actions.length - 1]
      const prevOp = prevAction[prevAction.length - 1]

      if (
        nodeId === prevOp.nodeId &&
        type === 'node:update' &&
        type === prevOp.type &&
        group &&
        group === prevOp.group
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

    const movie = this.#movie
    const { nodes } = movie

    this.untracked(() => {
      const orderedOps = redo ? ops : ops.slice().reverse()

      orderedOps.forEach((op) => {
        const { nodeId } = op

        if (redo) {
          switch (op.type) {
            // create
            case 'node:create':
              movie.createNode(op.init)
              break
            // move
            case 'node:move': {
              const node = nodes.get(nodeId)
              const { to } = op
              if (node.parent?.id !== to?.parentId) node.remove()
              if (to)
                (nodes.get(to.parentId) as ParentNode<any, any> | undefined)?.positionChildAt(node, to.index)
              break
            }
            // udpate
            case 'node:update': {
              const node = nodes.get(nodeId)
              node.patch(op.to as any)
              break
            }
            // delete
            case 'node:delete':
              nodes.get(nodeId).dispose()
              break
          }
        } else {
          switch (op.type) {
            // delete created
            case 'node:create':
              nodes.get(nodeId).dispose()
              break
            // move back
            case 'node:move': {
              const node = nodes.get(nodeId)
              const { from } = op
              if (node.parent?.id !== from?.parentId) node.remove()
              if (from)
                (nodes.get(from.parentId) as ParentNode<any, any> | undefined)?.positionChildAt(
                  node,
                  from.index,
                )
              break
            }
            // revert udpate
            case 'node:update': {
              const node = nodes.get(nodeId)
              node.patch(op.from as any)
              break
            }
            // recreate deleted
            case 'node:delete':
              movie.createNode(op.from)
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

  #onCreate(event: NodeCreateEvent): void {
    const { nodeId } = event
    this.#add([{ type: 'node:create', nodeId, init: this.#movie.nodes.get(nodeId).toObject() }])
  }
  #onMove(event: NodeMoveEvent): void {
    const { from, nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const to = node.parent && { parentId: node.parent.id, index: node.index }

    this.#add([{ type: 'node:move', nodeId, from, to }])
  }
  #onUpdate(event: NodeUpdateEvent): void {
    const { from, nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const to: Record<string, unknown> = {}

    for (const key in from) {
      if (Object.hasOwn(from, key)) {
        to[key] = node[key as keyof typeof node]
      }
    }

    this.#add([{ type: 'node:update', nodeId: event.nodeId, from, to }])
  }
  #onDelete(event: NodeDeleteEvent): void {
    const { nodeId } = event
    const node = this.#movie.nodes.get(nodeId)
    const { parent } = node

    this.#add([
      { type: 'node:move', nodeId, from: parent && { parentId: parent.id, index: node.index } },
      { type: 'node:delete', nodeId, from: node.toObject() },
    ])
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
