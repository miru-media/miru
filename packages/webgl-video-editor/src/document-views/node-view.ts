import type * as pub from '../../types/core.d.ts'

export abstract class NodeView<TDocView, T extends pub.AnyNode> {
  docView: TDocView
  original: T
  isDisposed = false

  constructor(docView: TDocView, original: T) {
    this.docView = docView
    this.original = original
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function -- noop */
  /** @internal */
  _move(_parent: NodeView<TDocView, pub.AnyNode> | undefined, _originalIndex: number): void {}
  /** @internal */
  _update(_key: keyof T, _oldValue: T[typeof _key]): void {}
  /* eslint-enable @typescript-eslint/class-methods-use-this, @typescript-eslint/no-empty-function */

  dispose(): void {
    this.isDisposed = true
    this.original = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
