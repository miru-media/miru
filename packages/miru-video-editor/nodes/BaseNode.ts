import { type ParentNode } from './ParentNode'

export abstract class BaseNode {
  id: string
  parent?: ParentNode
  declare root: ParentNode
  declare children?: unknown

  isDisposed = false

  constructor(id: string, parent: ParentNode | undefined) {
    this.id = id
    this.parent = parent
    if (parent?.root) this.root = parent.root
  }

  dispose() {
    if (this.isDisposed) return

    this._dispose()
    this.parent = undefined
    this.root = undefined as never
    this.isDisposed = true
  }

  abstract _dispose(): void
}
