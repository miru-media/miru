import { createEffectScope } from 'fine-jsx'
import * as Vue from 'vue'

import type * as pub from '#core'
import type { Valueof } from '#internal'

import { DocumentView, type ViewType } from '../document-view.ts'
import { defineWrapperProps } from '../utils.ts'

import {
  createEditViewProxy,
  type EditAudioClip,
  EditClip,
  type EditGap,
  type EditTimeline,
  type EditTrack,
  type EditVideoClip,
  EditView,
} from './edit-nodes.ts'

export interface ViewTypeMap {
  timeline: EditTimeline
  track: EditTrack
  clip: EditVideoClip | EditAudioClip
  gap: EditGap
}

/**
 * This {@link DocumentView} wraps the original document and timeline nodes, adding methods that let us edit
 * node properties and preview the changes without syncing or being interrupted by external changes to the
 * same prop.
 */
export class EditDocument extends DocumentView<ViewTypeMap> implements pub.Document {
  readonly vueScope = Vue.effectScope()
  readonly fineJsxScope = createEffectScope()
  edits = new Map<pub.AnyNode, pub.Schema.AnyNode>()

  declare resolution: pub.Document['resolution']
  declare frameRate: pub.Document['frameRate']
  declare readonly currentTime: pub.Document['currentTime']
  declare readonly duration: pub.Document['duration']
  declare readonly timeline: pub.Document['timeline']
  declare readonly assets: pub.Document['assets']
  declare readonly isEmpty: pub.Document['isEmpty']
  /** @internal */
  declare readonly activeClipIsStalled: pub.Document['activeClipIsStalled']

  readonly #eventTarget = new EventTarget()
  readonly ownEvents = new WeakSet<Event>()

  nodes = {
    get: <T extends pub.AnyNode>(id: string) =>
      this._getNode(this.doc.nodes.get(id)) as unknown as T & EditView<T>,
    set: () => {
      throw new Error('Unreachable?')
    },
    has: this.doc.nodes.has.bind(this.doc.nodes),
    delete: this.doc.nodes.delete.bind(this.doc.nodes),
    forEach: this.doc.nodes.forEach,
  }

  seekTo = this.doc.seekTo.bind(this.doc)
  _setCurrentTime = this.doc._setCurrentTime.bind(this.doc)
  importFromJson = this.doc.importFromJson.bind(this.doc)
  toJSON = this.doc.toJSON.bind(this.doc)
  emit = this.doc.emit.bind(this.doc)

  constructor(doc: pub.Document) {
    super(doc)

    const listenerOptions: AddEventListenerOptions = { signal: this._abort.signal }
    const onEventWithNode = this.#onEventWithNode.bind(this)

    // must be before the delete listener is added in this._init()
    this.doc.on('node:delete', onEventWithNode, listenerOptions)

    this._init()
    ;(
      [
        'node:create',
        'node:move',
        'node:update',
        'canvas:pointerdown',
        'canvas:pointermove',
        'canvas:pointerup',
      ] satisfies (keyof pub.VideoEditorEvents)[]
    ).forEach((type) => void this.doc.on(type, onEventWithNode, listenerOptions))

    this.timeline = this._getNode(doc.timeline)
  }

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T> {
    const view = original.isClip() ? new EditClip(this, original) : new EditView(this, original)
    const proxy = createEditViewProxy(view)
    return proxy as unknown as ViewType<ViewTypeMap, T>
  }

  _getNode<T extends undefined>(original: T): T
  _getNode<T extends pub.AnyNode>(original: T): ViewType<ViewTypeMap, T>
  _getNode<T extends pub.AnyNode | undefined>(original: T): ViewType<ViewTypeMap, T>
  _getNode<T extends pub.AnyNode | undefined>(original: T): ViewType<ViewTypeMap, T> | undefined {
    return original?._is_edit_view
      ? (original as unknown as ViewType<ViewTypeMap, T>)
      : super._getNode(original)
  }

  createNode<T extends pub.Schema.AnyNode>(init: T): pub.NodesByType[T['type']] {
    const node = this.doc.createNode(init)
    return (this._createView(node) as typeof node | undefined) ?? node
  }

  #onEventWithNode(
    event: pub.VideoEditorEvents[Extract<keyof pub.VideoEditorEvents, `node:${string}` | `canvas:${string}`>],
  ) {
    const { node } = event
    const view = node && this._getNode(node)

    if (!view) {
      this.#eventTarget.dispatchEvent(event.clone())
      return
    }

    let newEvent

    switch (event.type) {
      case 'node:create':
        newEvent = event.clone(view)
        break
      case 'node:move':
        newEvent = event.clone(view, event.from)
        break
      case 'node:update': {
        const editProps = view._editedProps.value
        // ignore updates while editing
        if (editProps && !view._isEnding && event.key in editProps) return
        newEvent = event.clone(view, event.key, event.from)
        break
      }
      case 'node:delete':
        newEvent = event.clone(view)
        break
      default:
        newEvent = event.clone(view as any)
    }

    this.#eventTarget.dispatchEvent(newEvent)
  }

  on(
    type: keyof pub.VideoEditorEvents,
    listener: (event: Valueof<pub.VideoEditorEvents>) => void,
    options_?: AddEventListenerOptions,
  ) {
    const options: AddEventListenerOptions = { signal: this._abort.signal, ...options_ }

    if (type.startsWith('node:') || type.startsWith('canvas:')) {
      this.#eventTarget.addEventListener(type, listener, options)
      return () => this.#eventTarget.removeEventListener(type, listener, options)
    }

    return this.doc.on(type, listener, options)
  }

  _emit(event: pub.VideoEditorEvents[keyof pub.VideoEditorEvents]): void {
    this.#eventTarget.dispatchEvent(event)
  }

  dispose(): void {
    this.doc.dispose()
    super.dispose()
  }
}

defineWrapperProps(EditDocument, 'doc', [
  'resolution',
  'frameRate',
  'currentTime',
  'duration',
  'timeline',
  'assets',
  'isEmpty',
  'activeClipIsStalled',
])
