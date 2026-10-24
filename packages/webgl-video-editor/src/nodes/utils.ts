import { computed, ref } from 'fine-jsx'

import { binarySearch } from 'shared/utils'

export class DLL<T extends { readonly index: number; next: any; prev: any }> {
  readonly #head = ref<T>()
  readonly #tail = ref<T>()

  get head(): T | undefined {
    return this.#head.value
  }
  get tail(): T | undefined {
    return this.#tail.value
  }

  readonly array = computed(() => {
    const array: T[] = []
    for (let current = this.#head.value; current; current = current.next) array.push(current)
    return array
  })

  positionAt(node: T, index: number): void {
    let before = this.#head.value
    for (; !!before && before.index < index; before = before.next);

    if (before === node.next) before = before?.next

    this.#insertBefore(node, before)
  }

  push(node: T): void {
    this.unlink(node)

    const tail = this.#tail.value

    if (tail) {
      tail.next = node
      node.prev = tail
    } else this.#head.value = node

    this.#tail.value = node
    node.next = undefined
  }

  unlink(node: T): void {
    const { prev, next } = node as { next: T | undefined; prev: T | undefined }

    if (node === this.head) this.#head.value = next
    if (node === this.tail) this.#tail.value = prev
    if (prev) prev.next = next
    if (next) next.prev = prev

    node.prev = node.next = undefined
  }

  #insertBefore(node: T, before: T | undefined): void {
    if (node === before) return

    this.unlink(node)
    node.next = before

    if (!before) {
      this.push(node)
      return
    }

    node.prev = before.prev

    const head = this.#head
    const { prev } = before as { next: T | undefined; prev: T | undefined }
    if (before === head.value) head.value = node
    if (prev) prev.next = node
    before.prev = node
  }

  search<U>(comparator: (a: T, b: U) => number, value: U, from?: number, to?: number): number {
    return this.#head.value ? binarySearch(this.array.value, comparator, value, from, to) : -1
  }

  dispose(): void {
    const tail = this.#tail
    while (tail.value) this.unlink(tail.value)
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
