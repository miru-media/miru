import { computed, ref } from 'fine-jsx'

import type * as pub from '#core'
import type { StringKeyof } from '#internal'
import { binarySearch } from 'shared/utils'

export class DLLNode {
  declare prev: this | undefined
  declare next: this | undefined
  declare readonly index: number

  constructor() {
    defineReactiveProp(this, 'prev')
    defineReactiveProp(this, 'next')
    defineComputedProp(this, 'index', () => (this.prev ? this.prev.index + 1 : 0))
  }
}

export class DLL<T extends DLLNode> {
  declare head: T | undefined
  declare tail: T | undefined

  readonly array = computed(() => {
    const array: T[] = []
    for (let current = this.head; current; current = current.next) array.push(current)
    return array
  })

  constructor() {
    defineReactiveProp(this, 'head')
    defineReactiveProp(this, 'tail')
  }

  positionAt(node: T, index: number): void {
    let before = this.head
    for (; !!before && before.index < index; before = before.next);

    if (before === node.next) before = before?.next

    this._insertBefore(node, before)
  }

  _push(node: T): void {
    this.unlink(node)

    const { tail } = this

    if (tail) {
      tail.next = node
      node.prev = tail
    } else this.head = node

    this.tail = node
    node.next = undefined
  }

  unlink(node: T): void {
    const { prev, next } = node as { next: T | undefined; prev: T | undefined }

    if (node === this.head) this.head = next
    if (node === this.tail) this.tail = prev
    if (prev) prev.next = next
    if (next) next.prev = prev

    node.prev = node.next = undefined
  }

  private _insertBefore(node: T, before: T | undefined): void {
    if (node === before) return

    this.unlink(node)
    node.next = before

    if (!before) {
      this._push(node)
      return
    }

    node.prev = before.prev

    const { prev } = before as { next: T | undefined; prev: T | undefined }
    if (before === this.head) this.head = node
    if (prev) prev.next = node
    before.prev = node
  }

  search<U>(comparator: (a: T, b: U) => number, value: U, from?: number, to?: number): number {
    return this.head ? binarySearch(this.array.value, comparator, value, from, to) : -1
  }

  dispose(): void {
    while (this.tail) this.unlink(this.tail)
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}

export const defineReactiveProp = <T, K extends keyof T>(obj: T, key: K, initialValue?: T[K]): void => {
  const _ref = ref(initialValue)
  Object.defineProperty(obj, key, {
    get: () => _ref.value,
    set: (value: T[K]) => void (_ref.value = value),
    enumerable: true,
  })
}

export const defineComputedProp = <T, K extends keyof T>(
  obj: T,
  key: K,
  getter: () => T[K],
  equals?: (a: T[K] | undefined, b: T[K] | undefined) => boolean,
): void => {
  const _ref = computed(getter, equals)
  Object.defineProperty(obj, key, { get: () => _ref.value, enumerable: true })
}

export class NodePropList<T extends DLLNode> extends DLL<T> {
  private _emit: (action: pub.NodeListChangeEvent.Action) => void

  constructor(emitAction: (action: pub.NodeListChangeEvent.Action) => void) {
    super()
    this._emit = emitAction
  }

  insert(index: number, item: T): void {
    this.positionAt(item, index)
    this._emit({ type: 'insert', index })
  }

  update<K extends StringKeyof<T>>(index: number, key: K, value: T[K]): void {
    const item = this.array.value[index]
    const from = item[key]
    item[key] = value
    this._emit({ type: 'update', index, key, from })
  }

  delete(index: number): void {
    const item = this.array.value[index]
    this.unlink(item)
    this._emit({ type: 'delete', index, item })
  }

  pushInitial(item: T): void {
    this._push(item)
  }

  toJSON<J>(this: { head?: T; array: { value: { toJSON: () => J }[] } }): J[] | undefined {
    if (!this.head) return
    return this.array.value.map((item) => item.toJSON())
  }

  dispose(): void {
    super.dispose()
    this._emit = undefined as never
  }
}
