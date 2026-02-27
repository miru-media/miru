import { ref } from 'fine-jsx'

import type { AnyNode, AnyParentNode, Schema } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'
import type { NonReadonly } from '../../types/internal.d.ts'

import { BaseNode } from './base-node.ts'

export abstract class ParentNode<
    T extends Schema.AnyNodeSchema,
    TParent extends AnyParentNode = AnyParentNode,
    TChild extends AnyNode = AnyNode,
  >
  extends BaseNode<T, TParent>
  implements pub.ParentNode<TChild>
{
  readonly #head = ref<TChild>()
  readonly #tail = ref<TChild>()

  get head(): TChild | undefined {
    return this.#head.value
  }
  get tail(): TChild | undefined {
    return this.#tail.value
  }

  declare children: TChild[]

  get ['children' as never](): TChild[] {
    const array: TChild[] = []
    for (let current = this.#head.value; current; current = current.next as TChild) array.push(current)
    return array
  }

  protected _count(): number {
    const { tail } = this
    return tail ? tail.index + 1 : 0
  }

  constructor(doc: pub.Document, init: T) {
    super(doc, init)

    this.onDispose(() => {
      while (this.tail) this.tail.dispose()
      this.#head.value = this.#tail.value = undefined
    })
  }

  #setChildparent(child: TChild): void {
    ;(child as NonReadonly<TChild>).parent = this as unknown as TParent
  }

  _positionChildAt(node: TChild, index: number): void {
    if (node.index === index && node.parent === (this as unknown as AnyParentNode)) return

    let other = this.head
    for (; !!other && other.index < index; other = other.next as TChild);

    this.#insertBefore(node, other)
  }

  #pushChild(node: TChild): void {
    this._unlinkChild(node)
    this.#setChildparent(node)

    const tail = this.#tail.value

    if (!tail) this.#head.value = node
    else {
      tail.next = node
      node.prev = tail
    }

    this.#tail.value = node
    node.next = undefined
  }

  _unlinkChild(node: TChild): void {
    const { head, tail } = this
    const { prev, next } = node

    if (node === head) this.#head.value = next as TChild
    if (node === tail) this.#tail.value = prev as TChild
    if (prev != null) prev.next = next
    if (next != null) next.prev = prev

    node.prev = node.next = undefined
  }

  #insertBefore(node: TChild, before: TChild | undefined): void {
    if (node === before) return

    this._unlinkChild(node)
    this.#setChildparent(node)
    node.next = before

    if (!before) {
      this.#pushChild(node)
      return
    }

    node.prev = before.prev

    const { head } = this
    const { prev } = before
    if (before === head) this.#head.value = node
    if (prev != null) prev.next = node
    before.prev = node
  }
}
