import { NODE_FIELD_FLAGS } from '#constants'
import type { AnyNode, AnyParentNode, Schema } from '#core'
import type * as pub from '#core'
import type { NonReadonly } from '#internal'

import { BaseNode } from './base-node.ts'
import { DLL } from './utils.ts'

export abstract class ParentNode<
  T extends Schema.AnyNode,
  TParent extends AnyParentNode = AnyParentNode,
  TChild extends AnyNode = AnyNode,
>
  extends BaseNode<T, TParent>
  implements pub.ParentNode<TChild>
{
  static FIELDS = super.FIELDS.concat([
    { key: 'head', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'tail', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'children', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.NodeArray },
    { key: 'count', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.ParentNode<pub.AnyNode>>[])

  readonly #dll = new DLL<TChild>()

  get head(): TChild | undefined {
    return this.#dll.head
  }
  get tail(): TChild | undefined {
    return this.#dll.tail
  }

  declare children: TChild[]
  get ['children' as never](): TChild[] {
    return this.#dll.array.value
  }

  get count(): number {
    const { tail } = this
    return tail ? tail.index + 1 : 0
  }

  _positionChildAt(node: TChild, index: number): void {
    if (node.index === index && node.parent === (this as unknown as AnyParentNode)) return

    this.#dll.positionAt(node, index)
    ;(node as NonReadonly<TChild>).parent = this as unknown as TParent
  }

  _unlinkChild(node: TChild): void {
    this.#dll.unlink(node)
  }

  search<U>(comparator: (a: TChild, b: U) => number, value: U, from?: number, to?: number): number {
    return this.#dll.search(comparator, value, from, to)
  }

  dispose(deep = false): void {
    super.dispose()

    if (deep) while (this.tail) this.tail.dispose()
    else while (this.tail) this.tail.remove()
    this.#dll.dispose()
  }
}
