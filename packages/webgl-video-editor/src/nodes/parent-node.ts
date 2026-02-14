import { ref } from 'fine-jsx'

import type { Schema } from '../../types/core'
import type { NonReadonly, RootNode } from '../../types/internal'

import { BaseNode } from './base-node.ts'

export abstract class ParentNode<
  T extends Schema.AnyNodeSchema,
  TChild extends BaseNode,
> extends BaseNode<T> {
  readonly #head = ref<TChild>()
  readonly #tail = ref<TChild>()

  get head(): TChild | undefined {
    return this.#head.value
  }
  get tail(): TChild | undefined {
    return this.#tail.value
  }

  get children(): TChild[] {
    const array: TChild[] = []
    for (let current = this.#head.value; current; current = current.next) array.push(current)
    return array
  }

  get count(): number {
    return (this.#tail.value?.index ?? -1) + 1
  }

  constructor(id: string, root?: RootNode) {
    super(id, root)

    this.onDispose(() => {
      while (this.tail) this.tail.dispose()
      this.#head.value = this.#tail.value = undefined
    })
  }

  #setChildparent(child: this['children'][number]): void {
    ;(child as NonReadonly<typeof child>).parent = this
  }

  positionChildAt(node: TChild, index: number): void {
    if (node.index === index && node.parent === this) return

    let other = this.head
    for (; !!other && other.index < index; other = other.next);

    this._insertBefore(node, other)
  }

  _forEachChild(fn: (node: TChild, index: number) => unknown): void {
    let index = 0
    for (let current = this.#head.value; current; current = current.next) fn(current, index++)
  }
  _mapChildren<U>(fn: (node: TChild, index: number) => U): U[] {
    const array: U[] = []
    this._forEachChild((node, index) => array.push(fn(node, index)))
    return array
  }

  pushChild(node: TChild): void {
    this.unlinkChild(node)
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

  unlinkChild(node: TChild): void {
    const { head, tail } = this
    const { prev, next } = node

    if (node === head) this.#head.value = next
    if (node === tail) this.#tail.value = prev
    if (prev) prev.next = next
    if (next) next.prev = prev

    node.prev = node.next = undefined
  }

  protected _insertBefore(node: TChild, before: TChild | undefined): void {
    if (node === before) return

    this.unlinkChild(node)
    this.#setChildparent(node)

    node.next = before

    if (!before) {
      this.pushChild(node)
      return
    }

    node.prev = before.prev

    const { head } = this
    const { prev } = before
    if (before === head) this.#head.value = node
    if (prev) prev.next = node

    before.prev = node
  }
}
