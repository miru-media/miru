import type * as pub from '../../types/core.d.ts'

import type { NodeView } from './node-view.ts'

export type ViewType<
  TMap extends Partial<Record<pub.AnyNode['type'], NodeView<any, any>>>,
  T extends pub.AnyNode | undefined,
> = T extends undefined
  ? undefined
  : NonNullable<T>['type'] extends keyof TMap
    ? TMap[NonNullable<T>['type']]
    : undefined

export abstract class DocumentView<TMap extends Partial<Record<pub.AnyNode['type'], NodeView<any, any>>>> {
  readonly doc: pub.Document
  readonly #map = new Map<string, NonNullable<ViewType<TMap, pub.AnyNode>>>()
  protected readonly _abort = new AbortController()
  isDisposed = false

  constructor(options: { doc: pub.Document }) {
    const { doc } = options
    this.doc = doc
  }

  protected _init(): void {
    const { doc } = this
    const listenerOptions = { signal: this._abort.signal }

    doc.on('doc:dispose', this.dispose.bind(this), listenerOptions)

    doc.on('node:create', this.#onCreate.bind(this), listenerOptions)
    doc.on('node:move', this.#onMove.bind(this), listenerOptions)
    doc.on('node:update', this.#onUpdate.bind(this), listenerOptions)
    doc.on('node:delete', this.#onDelete.bind(this), listenerOptions)

    doc.nodes.map.forEach((node) => this._createNode(node))
  }

  protected abstract _createView<T extends pub.AnyNode>(original: T): ViewType<TMap, T>

  /** @internal */
  _createNode<T extends pub.AnyNode>(original: T): ViewType<TMap, T> {
    const view = this._createView(original)
    if (view) this.#map.set(original.id, view)
    return view
  }

  _getNode<T extends undefined>(original: T): T
  _getNode<T extends pub.AnyNode>(original: T): ViewType<TMap, T>
  _getNode<T extends pub.AnyNode | undefined>(original: T): ViewType<TMap, T>
  _getNode<T extends pub.AnyNode | undefined>(original: T): ViewType<TMap, T> | undefined {
    return original && (this.#map.get(original.id) as ViewType<TMap, T>)
  }

  #onCreate({ node }: pub.NodeCreateEvent): void {
    this._createNode(node)
  }
  #onMove({ node }: pub.NodeMoveEvent): void {
    const { parent } = node

    this._getNode(node)?._move(parent && this._getNode(parent), node.index)
  }
  #onUpdate({ node, from }: pub.NodeUpdateEvent): void {
    const view = this._getNode(node)
    if (!view) return
    Object.keys(from).forEach((key) => view._update(key, from[key]))
  }
  #onDelete({ node }: pub.NodeDeleteEvent): void {
    const view = this._getNode(node)
    if (!view) return

    view.dispose()
    this.#map.delete(node.id)
  }

  dispose() {
    this.isDisposed = true
    const viewMap = this.#map
    viewMap.forEach((view) => view.dispose())
    viewMap.clear()
    this._abort.abort()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
