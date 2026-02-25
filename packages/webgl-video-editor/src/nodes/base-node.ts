import { computed, ref } from 'fine-jsx'
import type * as Pixi from 'pixi.js'

import type { ChildNodePosition } from '../../types/core'
import type { AnyNode, AnyParentNode, NodeSnapshot, NonReadonly, RootNode } from '../../types/internal'
import { NodeCreateEvent, NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from '../events.ts'

import type { AudioClip, BaseClip, Gap, Schema, Timeline, Track, VisualClip } from './index.ts'

export abstract class BaseNode<T extends Schema.Base = any, TParent extends AnyParentNode = AnyParentNode> {
  readonly type: T['type']
  readonly id: string
  declare readonly root: RootNode
  abstract readonly children?: unknown
  abstract container?: Pixi.Container

  readonly #parent = ref<TParent>()

  declare parent?: TParent | undefined
  get ['parent' as never](): TParent | undefined {
    return this.#parent.value
  }
  set ['parent' as never](node: TParent | undefined) {
    this.#parent.value = node
  }

  readonly #prev = ref<unknown>()
  readonly #next = ref<unknown>()

  declare prev: TParent['children'][number] | undefined
  declare next: TParent['children'][number] | undefined

  get ['prev' as never]() {
    return this.#prev.value
  }
  set ['prev' as never](other: this['prev']) {
    this.#prev.value = other
  }
  get ['next' as never]() {
    return this.#next.value
  }
  set ['next' as never](other: this['next']) {
    this.#next.value = other
  }

  isDisposed = false
  readonly #cleanups: (() => void)[] = []

  readonly #index = computed((): number => {
    const prev = this.prev as BaseNode | undefined
    if (prev) return prev.index + 1
    if (this.parent?.head === (this as unknown as AnyNode)) return 0
    return -1
  })

  get index(): number {
    return this.#index.value
  }

  constructor(init: T, root?: RootNode) {
    this.id = init.id
    this.type = init.type

    if (root) this.root = root

    this._init(init)
    root?._emit(new NodeCreateEvent(this))
  }

  protected abstract _init(init: T): void

  abstract toObject(): Schema.Base

  getSnapshot(): NodeSnapshot<T extends Schema.AnyNodeSchema ? T : any> {
    return {
      node: this.toObject() as T extends Schema.AnyNodeSchema ? T : any,
      position: this.parent && { parentId: this.parent.id, index: this.#index.value },
    }
  }

  treePosition(position: ChildNodePosition | undefined) {
    const parentId = position?.parentId
    if (parentId === this.parent?.id && (!position || position.index === this.index)) return

    const fromParent = this.parent
    const fromIndex = this.index
    const newParent = parentId ? (this.root.nodes.get(parentId) as unknown as TParent) : undefined

    if (fromParent && fromParent.id !== parentId) fromParent._unlinkChild(this as any)

    if (position) newParent?._positionChildAt(this as any, position.index)
    else (this as NonReadonly<typeof this>).parent = undefined

    const { container } = this
    if (container) {
      if (!newParent) container.removeFromParent()
      else if (this.isVisual()) {
        if (newParent.id !== fromParent?.id) newParent.container.addChild(container)
        container.zIndex = this.index
      }
    }

    this.root._emit(new NodeMoveEvent(this, fromParent && { parentId: fromParent.id, index: fromIndex }))
  }

  remove(): void {
    this.treePosition(undefined)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTimeline(): this is Timeline {
    return false
  }
  isTrack(): this is Track {
    return false
  }
  isClip(): this is BaseClip {
    return false
  }
  isGap(): this is Gap {
    return false
  }
  isVisual(): this is VisualClip | Track {
    return false
  }
  isAudio(): this is AudioClip | Track {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  #emitUpdate<Key extends keyof T>(key: Exclude<Key, 'id' | 'type'>, oldValue: T[Key]): void {
    const event = new NodeUpdateEvent(this, { [key]: oldValue })
    this.root._emit(event)
  }

  protected _defineReactive<Key extends keyof T>(
    key: Extract<Exclude<Key, 'id' | 'type'>, string>,
    initialValue: T[Key],
    options: {
      equal?: (a: T[Key], b: T[Key]) => boolean
      emit?: boolean
      onChange?: (value: T[Key]) => void
      defaultValue?: T[Key]
    } = {},
  ): void {
    const ref_ = ref(initialValue)
    type This = typeof this
    const equal = options.equal ?? Object.is

    Object.defineProperty(this, key, {
      get() {
        const { value } = ref_
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- distinguishing null value
        return value === undefined ? options.defaultValue : value
      },
      set(this: This, value: T[Key]) {
        const prev = ref_.value
        if (equal(prev, value)) return

        ref_.value = value

        options.onChange?.(value)
        if (options.emit !== false) this.#emitUpdate(key, prev)
      },
      configurable: true,
      enumerable: true,
    })

    options.onChange?.(initialValue)
  }

  dispose() {
    if (this.isDisposed) return

    this.#cleanups.forEach((fn) => fn())

    this.parent?._unlinkChild(this as any)
    this.container?.destroy()
    this.root._emit(new NodeDeleteEvent(this))
    this.isDisposed = true
    ;(this as unknown as NonReadonly<typeof this>).root = undefined as never
  }

  onDispose(fn: () => void) {
    this.#cleanups.push(fn)
  }
}
