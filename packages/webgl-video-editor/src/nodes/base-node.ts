import { computed, ref } from 'fine-jsx'

import type { AnyNode, AnyParentNode, ChildNodePosition } from '../../types/core.d.ts'
import type * as pub from '../../types/core.d.ts'
import type { NodeSnapshot, NonReadonly } from '../../types/internal.d.ts'
import { NodeCreateEvent, NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from '../events.ts'

import type { Schema } from './index.ts'

export abstract class BaseNode<T extends Schema.Base = any, TParent extends AnyParentNode = AnyParentNode>
  implements pub.BaseNode
{
  readonly type: T['type']
  readonly id: string
  declare readonly doc: pub.Document
  abstract readonly children?: unknown

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
    const { prev } = this
    if (prev) return prev.index + 1
    if (this.parent?.head === (this as unknown as AnyNode)) return 0
    return -1
  })

  get index(): number {
    return this.#index.value
  }

  constructor(doc: pub.Document, init: T) {
    this.id = init.id
    this.type = init.type

    this.doc = doc
    this._init(init)

    doc.emit(new NodeCreateEvent(this as unknown as AnyNode))
  }

  protected abstract _init(init: T): void

  abstract toObject(): Schema.Base

  getSnapshot(): NodeSnapshot<T extends Schema.AnyNodeSchema ? T : any> {
    return {
      node: this.toObject() as T extends Schema.AnyNodeSchema ? T : any,
      position: this.parent && { parentId: this.parent.id, index: this.#index.value },
    }
  }

  move(position: ChildNodePosition | undefined) {
    const parentId = position?.parentId
    if (parentId === this.parent?.id && (!position || position.index === this.index)) return

    const fromParent = this.parent
    const fromIndex = this.index
    const newParent = parentId ? (this.doc.nodes.get(parentId) as unknown as TParent) : undefined

    if (fromParent && fromParent.id !== parentId) fromParent._unlinkChild(this as any)

    if (position) newParent?._positionChildAt(this as any, position.index)
    else (this as NonReadonly<typeof this>).parent = undefined

    this.doc.emit(
      new NodeMoveEvent(
        this as unknown as AnyNode,
        fromParent && { parentId: fromParent.id, index: fromIndex },
      ),
    )
  }

  remove(): void {
    this.move(undefined)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTimeline(): this is pub.Timeline {
    return false
  }
  isTrack(): this is pub.Track {
    return false
  }
  isTrackChild(): this is pub.AnyTrackChild {
    return false
  }
  isClip(): this is pub.AnyClip {
    return false
  }
  isGap(): this is pub.Gap {
    return false
  }
  isVisual(): this is pub.AnyVisualNode {
    return false
  }
  isAudio(): this is pub.AnyAudioNode {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  #emitUpdate<Key extends keyof T>(key: Exclude<Key, 'id' | 'type'>, oldValue: T[Key]): void {
    const event = new NodeUpdateEvent(this as unknown as AnyNode, key as any, oldValue)
    this.doc.emit(event)
  }

  protected _defineReactive<Key extends keyof T>(
    key: Extract<Exclude<Key, 'id' | 'type'>, string>,
    initialValue: T[Key],
    options: {
      equal?: (a: T[Key], b: T[Key]) => boolean
      emit?: boolean
      onChange?: (value: T[Key]) => unknown
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

  delete(): void {
    this.parent?._unlinkChild(this as any)
    this.doc.emit(new NodeDeleteEvent(this as unknown as AnyNode))
    this.dispose()
  }

  dispose() {
    if (this.isDisposed) return
    this.isDisposed = true

    this.#cleanups.forEach((fn) => fn())

    this.parent?._unlinkChild(this as any)
    ;(this as unknown as NonReadonly<typeof this>).doc = undefined as never
    ;(this as NonReadonly<typeof this>).doc = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }

  onDispose(fn: () => void) {
    this.#cleanups.push(fn)
  }
}
