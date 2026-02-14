import { computed, ref } from 'fine-jsx'

import type { NodeSnapshot, NonReadonly, RootNode } from '../../types/internal'
import { NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from '../events.ts'
import type { ChildNodePosition, Schema } from '../index.ts'

import type { ParentNode } from './parent-node.ts'

export abstract class BaseNode<T extends Schema.Base = Schema.Base> {
  abstract readonly type: T['type']
  readonly id: string
  declare readonly parent?: ParentNode<any, BaseNode<T>>
  declare readonly root: RootNode
  abstract readonly children?: unknown

  readonly #parent = ref<ParentNode<any, BaseNode<T>>>()

  get ['parent' as never](): typeof this.parent {
    return this.#parent.value
  }
  set ['parent' as never](parent: typeof this.parent) {
    this.#parent.value = parent
  }

  readonly #prev = ref<BaseNode<T>>()
  readonly #next = ref<BaseNode<T>>()

  get prev(): this | undefined {
    return this.#prev.value as typeof this | undefined
  }
  set prev(other) {
    this.#prev.value = other
  }
  get next(): this | undefined {
    return this.#next.value as typeof this | undefined
  }
  set next(other) {
    this.#next.value = other
  }

  isDisposed = false
  readonly #cleanups: (() => void)[] = []

  readonly #index = computed((): number => {
    const { prev } = this
    if (prev) return prev.index + 1
    if (this.parent?.head === this) return 0
    return -1
  })

  get index(): number {
    return this.#index.value
  }

  constructor(id: string, root?: RootNode) {
    this.id = id

    if (root) this.root = root
  }

  abstract toObject(): T

  getSnapshot(): NodeSnapshot<T extends Schema.AnyNodeSchema ? T : any> {
    return {
      node: this.toObject() as T extends Schema.AnyNodeSchema ? T : any,
      id: this.id,
      position: this.parent && { parentId: this.parent.id, index: this.#index.value },
    }
  }

  patch(updates: Partial<T>): void {
    type AnyRecord = Record<string, any>

    for (const key in updates) {
      if (Object.hasOwn(updates, key) && key in this) {
        ;(this as AnyRecord)[key] = (updates as AnyRecord)[key]
      }
    }
  }

  position(position: ChildNodePosition | undefined) {
    const parentId = position?.parentId
    if (parentId === this.parent?.id && (!position || position.index === this.index)) return

    const fromParent = this.parent
    const fromIndex = this.index
    const newParent = parentId ? (this.root.nodes.get(parentId) as ParentNode<any, BaseNode<any>>) : undefined

    if (fromParent && fromParent.id !== parentId) fromParent.unlinkChild(this)

    if (position) newParent?.positionChildAt(this, position.index)
    else (this as NonReadonly<typeof this>).parent = undefined

    this.root._emit(new NodeMoveEvent(this, fromParent && { parentId: fromParent.id, index: fromIndex }))
  }

  remove(): void {
    this.position(undefined)
  }

  #emitUpdate<Key extends Exclude<keyof T, 'id' | 'type'>>(key: Key, oldValue: T[Key]): void {
    const event = new NodeUpdateEvent(this, { [key]: oldValue })
    this.root._emit(event)
  }

  protected _defineReactive<Key extends Exclude<Extract<keyof T, string>, 'id' | 'type'>>(
    key: Key,
    initialValue: T[Key],
    options: {
      equal?: (a: T[Key], b: T[Key]) => boolean
      emit?: boolean
      onChange?: (value: T[Key]) => void
    } = {},
  ): void {
    const ref_ = ref(initialValue)
    type This = typeof this
    const equal = options.equal ?? Object.is

    Object.defineProperty(this, key, {
      get() {
        return ref_.value
      },
      set(this: This, value: T[Key]) {
        const prev = ref_.value
        if (equal(prev, value)) return

        ref_.value = value

        options.onChange?.(value)
        if (options.emit !== false) this.#emitUpdate(key, prev)
      },
    })

    options.onChange?.(initialValue)
  }

  dispose() {
    if (this.isDisposed) return

    this.#cleanups.forEach((fn) => fn())

    this.parent?.unlinkChild(this)
    this.root._emit(new NodeDeleteEvent(this))
    this.isDisposed = true
    ;(this as unknown as NonReadonly<typeof this.root>).root = undefined as never
  }

  onDispose(fn: () => void) {
    this.#cleanups.push(fn)
  }
}
