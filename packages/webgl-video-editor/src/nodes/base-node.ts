import type { ParentNode } from './parent-node'

export abstract class BaseNode {
  abstract type: string
  id: string
  parent?: ParentNode
  declare root: ParentNode
  declare children?: unknown

  isDisposed = false
  _cleanups: (() => void)[] = []

  constructor(id: string, parent: ParentNode | undefined) {
    this.id = id
    this.parent = parent
    if (parent?.root) this.root = parent.root
  }

  dispose() {
    if (this.isDisposed) return

    this._cleanups.forEach((fn) => fn())
    this.parent = undefined
    this.root = undefined as never
    this.isDisposed = true
  }

  onDispose(fn: () => void) {
    this._cleanups.push(fn)
  }
}
