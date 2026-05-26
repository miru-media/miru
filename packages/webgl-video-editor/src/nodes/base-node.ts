import { computed, ref } from 'fine-jsx'

import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonReadonly } from '#internal'

import { NodeCreateEvent, NodeDeleteEvent, NodeMoveEvent, NodeUpdateEvent } from '../events.ts'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in class def
export interface BaseNode<T extends Schema.Base = any, TParent extends pub.AnyParentNode = pub.AnyParentNode>
  extends pub.BaseNode {}

export abstract class BaseNode<
  T extends Schema.Base = any,
  TParent extends pub.AnyParentNode = pub.AnyParentNode,
>
  implements pub.BaseNode
{
  static FIELDS: pub.NodeFieldDef<any>[] = [
    { key: 'name', flags: 0, defaultValue: '' },
    { key: 'enabled', flags: 0, defaultValue: true },
    { key: 'effects', flags: 0, defaultValue: [] },
    { key: 'markers', flags: 0, defaultValue: [] },
    { key: 'color', flags: 0 },
    { key: 'metadata', flags: 0, defaultValue: {} },

    { key: 'doc', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'id', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'type', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'parent', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'index', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'prev', flags: NODE_FIELD_FLAGS.Node },
    { key: 'next', flags: NODE_FIELD_FLAGS.Node },
    { key: 'prevVideo', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'nextVideo', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'prevAudio', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'nextAudio', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
  ] satisfies pub.NodeFieldDef<pub.BaseNode & { type: string }>[]

  declare readonly doc: pub.Document

  readonly type: T['type']
  declare name: string

  readonly #parent = ref<TParent>()

  readonly _effectAssets = computed((): pub.VideoEffectAsset[] =>
    this.effects.map(({ assetId }) => this.doc.assets.getAsset(assetId)),
  )

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

  get prevVideo() {
    for (let other = this.prev; other; other = other.prev) if (other.isVideo()) return other
  }
  get nextVideo() {
    for (let other = this.next; other; other = other.next) if (other.isVideo()) return other
  }
  get prevAudio() {
    for (let other = this.prev; other; other = other.prev) if (other.isAudio()) return other
  }
  get nextAudio() {
    for (let other = this.next; other; other = other.next) if (other.isAudio()) return other
  }

  protected readonly _abort = new AbortController()
  isDisposed = false

  readonly #index = computed((): number => {
    const { prev } = this
    if (prev) return prev.index + 1
    if (this.parent?.head === (this as unknown as pub.AnyNode)) return 0
    return -1
  })

  get index(): number {
    return this.#index.value
  }

  constructor(doc: pub.Document, init: T) {
    this.doc = doc

    this.id = init.id
    this.type = init.type

    this._fields().forEach((field) => {
      if (field.flags !== 0) return
      const { key } = field
      this._defineReactive(key as any, (init as any)[key], field as any)
    })

    this.doc.assets.on(
      'asset:create',
      ({ asset }) => {
        if (asset.type !== 'asset:effect:video') return

        const index = this.effects.findIndex((e) => e.assetId === asset.id)
        if (index === -1) return

        const effectAssets = [...this._effectAssets.value]
        effectAssets[index] = asset
        this._effectAssets.value.length = 0
        this._effectAssets.value = effectAssets
      },
      { signal: this._abort.signal },
    )
    this._init(init)

    doc.emit(new NodeCreateEvent(this as unknown as pub.AnyNode))
  }

  protected abstract _init(init: T): void

  move(position: pub.ChildNodePosition | undefined) {
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
        this as unknown as pub.AnyNode,
        fromParent && { parentId: fromParent.id, index: fromIndex },
      ),
    )
  }

  remove(): void {
    this.move(undefined)
  }

  toJSON(): Pick<T, keyof Schema.Base> {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      enabled: this.enabled,
      effects: this.effects,
      color: this.color,
      metadata: this.metadata,
    }
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
  isMediaClip(): this is pub.AnyMediaClip {
    return false
  }
  isTextClip(): this is pub.TextClip {
    return false
  }
  isGap(): this is pub.Gap {
    return false
  }
  isVideo(): this is pub.AnyVideoNode {
    return false
  }
  isAudio(): this is pub.AnyAudioNode {
    return false
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  #emitUpdate<Key extends keyof T>(key: Exclude<Key, 'id' | 'type'>, oldValue: T[Key]): void {
    const event = new NodeUpdateEvent(this as unknown as pub.AnyNode, key as any, oldValue)
    this.doc.emit(event)
  }

  _fields<T extends pub.BaseNode>(this: T): pub.NodeFieldDef<T>[] {
    return (this.constructor as typeof BaseNode).FIELDS as any
  }

  _defineReactive<Key extends keyof T>(
    key: Extract<Exclude<Key, 'id' | 'type'>, string>,
    initialValue: T[Key],
    options: {
      equal?: (a: T[Key], b: T[Key]) => boolean
      transform?: (value: T[Key]) => T[Key]
      defaultValue?: T[Key]
    } = {},
  ): void {
    const ref_ = ref(options.transform ? options.transform(initialValue) : initialValue)
    type This = typeof this
    const equal = options.equal ?? Object.is

    Object.defineProperty(this, key, {
      get() {
        const { value } = ref_
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- distinguishing null value
        return value === undefined ? options.defaultValue : value
      },
      set(this: This, value_: T[Key]) {
        const prev = ref_.value
        const { transform } = options
        const value = transform ? transform(value_) : value_
        if (equal(prev, value)) return

        ref_.value = value

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- distinguishing null value
        this.#emitUpdate(key, prev === undefined ? (options.defaultValue as unknown as typeof prev) : prev)
      },
      configurable: true,
      enumerable: true,
    })
  }

  delete(): void {
    this.parent?._unlinkChild(this as any)
    this.doc.emit(new NodeDeleteEvent(this as unknown as pub.AnyNode))
    this.dispose()
  }

  dispose() {
    if (this.isDisposed) return
    this.isDisposed = true

    this._abort.abort()

    this.parent?._unlinkChild(this as any)
    ;(this as Partial<NonReadonly<typeof this>>).doc = undefined
  }

  [Symbol.dispose](): void {
    this.dispose()
  }

  onDispose(fn: () => void): void {
    this._abort.signal.addEventListener('abort', fn, { once: true })
  }
}
