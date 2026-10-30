import { computed, ref, type Ref } from 'fine-jsx'

import { Animation, type AnimationView, Keyframe } from '#animation'
import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'
import {
  NodeCreateEvent,
  NodeDeleteEvent,
  NodeListChangeEvent,
  NodeMoveEvent,
  NodeUpdateEvent,
} from '#events'
import type { NonReadonly } from '#internal'
import { Rational } from 'shared/utils/index.ts'

import { EffectList, EffectListItem } from '../effects/effect-list.ts'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in class def
export interface BaseNode<T extends Schema.Base = any, TParent extends pub.AnyParentNode = pub.AnyParentNode>
  extends pub.BaseNode {}

const visualPropFlags =
  NODE_FIELD_FLAGS.TransformProp | NODE_FIELD_FLAGS.ReactiveProp | NODE_FIELD_FLAGS.Animatable

export abstract class BaseNode<
  T extends Schema.Base = any,
  TParent extends pub.AnyParentNode = pub.AnyParentNode,
>
  implements pub.BaseNode
{
  static FIELDS: pub.NodeFieldDef<any>[] = [
    { key: 'name', flags: NODE_FIELD_FLAGS.ReactiveProp, defaultValue: '' },
    { key: 'enabled', flags: NODE_FIELD_FLAGS.ReactiveProp, defaultValue: true },
    { key: 'markers', flags: NODE_FIELD_FLAGS.ReactiveProp, defaultValue: [] },
    { key: 'color', flags: NODE_FIELD_FLAGS.ReactiveProp },
    { key: 'metadata', flags: NODE_FIELD_FLAGS.ReactiveProp, defaultValue: {} },

    { key: 'isNode', flags: NODE_FIELD_FLAGS.Constant },
    { key: 'doc', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'id', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'type', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'parent', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'index', flags: NODE_FIELD_FLAGS.Readonly },
    { key: 'prev', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
    { key: 'next', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
  ] satisfies pub.NodeFieldDef<pub.BaseNode & { type: string }>[]

  static VISUAL_FIELDS = [
    { key: 'translateX', flags: visualPropFlags, defaultValue: 0 },
    { key: 'translateY', flags: visualPropFlags, defaultValue: 0 },
    { key: 'rotate', flags: visualPropFlags, defaultValue: 0 },
    { key: 'scaleX', flags: visualPropFlags, defaultValue: 1 },
    { key: 'scaleY', flags: visualPropFlags, defaultValue: 1 },
    { key: 'opacity', flags: visualPropFlags, defaultValue: 1 },
  ] satisfies pub.NodeFieldDef<Schema.VisualProps>[]

  static _fieldsByKey: Record<string, pub.NodeFieldDef<any>> | undefined
  static get FIELDS_BY_KEY() {
    const { _fieldsByKey: _fieldsById } = this
    if (_fieldsById) return _fieldsById

    const fieldsById: typeof this._fieldsByKey = (this._fieldsByKey = {})
    this.FIELDS.forEach((field) => void (fieldsById[field.key] = field))
    return fieldsById
  }

  declare readonly doc: pub.Document

  readonly type: T['type']
  declare name: string

  readonly #parent = ref<TParent>()

  readonly animations: Partial<Record<string, pub.Animation>> = {}
  readonly animationMap = new Map<string, Animation>()
  readonly _animationViews = new Map<string, AnimationView>()

  readonly effects = EffectList.create((action) =>
    this.doc.emit(new NodeListChangeEvent(this as any, ['effects'], action)),
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
  readonly #refs: Record<string, Ref> = {}

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

  protected readonly _abort = new AbortController()
  isDisposed = false

  readonly #index = computed((): number => {
    const { prev } = this
    return prev ? prev.index + 1 : 0
  })

  get index(): number {
    return this.#index.value
  }

  constructor(doc: pub.Document, init: T) {
    this.doc = doc

    this.id = init.id
    this.type = init.type

    init.effects?.forEach((effect) => this.effects.pushInitial(new EffectListItem(effect)))

    this._fields().forEach((field) => {
      if (!(field.flags & NODE_FIELD_FLAGS.ReactiveProp)) return
      const { key } = field

      if (field.flags & NODE_FIELD_FLAGS.Animatable) {
        const animation = (this.animations[key] = new Animation(field.flags, (action) =>
          this.doc.emit(new NodeListChangeEvent(this as any, ['animations', key, 'keyframes'], action)),
        ))
        init.animations?.[key]?.keyframes.forEach((init) => animation.pushInitial(new Keyframe(init)))
        this.animationMap.set(key, animation)

        const view = animation.createView(() =>
          Rational.fromDecimal(this.doc.currentTime, this.doc.frameRate).subtract(this.getLocalTimeOffset()),
        )
        this._animationViews.set(key, view)
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc and eslint give different types
      this._defineReactive(key as any, (init as any)[key], field as any)
    })

    this.doc.assets.on(
      'asset:create',
      ({ asset }) => {
        if (asset.type !== 'asset:effect:video') return

        this.effects.array.value.forEach((effect) => {
          if (effect.assetId !== asset.id) return
          effect.asset = asset
        })
      },
      { signal: this._abort.signal },
    )

    this._init(init)

    doc.emit(new NodeCreateEvent(this as unknown as pub.AnyNode))
  }

  protected abstract _init(init: T): void

  _toggleKeyframesAt(keys: string[], time: Rational): void {
    const animations = keys
      .map((key) => [key, this.animations[key]] as const)
      .filter((entry): entry is [(typeof entry)[0], NonNullable<(typeof entry)[1]>] => !!entry[1])
    const hasKeyframeAtTime = animations.some(([, a]) => a.indexOfKeyframeAt(time) >= 0)

    if (hasKeyframeAtTime) {
      animations.forEach(([_key, animation]) => {
        const index = animation.indexOfKeyframeAt(time)
        if (index >= 0) animation.delete(index)
      })
    } else {
      animations.forEach(([key, animation]) => {
        const value = (this as any)[key]
        if (animation.keyframes.length) animation.updateOrCreateAtTime(value, time)
        else this._insertKeyframeAtTime(key, value, time)
      })
    }
  }

  _insertKeyframeAtTime(key: string, value: unknown, time: Rational, _index?: number): void {
    const animation = this.animations[key]!
    animation.createAtTime(value, time, _index)
  }

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
      effects: this.effects.toJSON(),
      animations: this._fields().reduce<Schema.Base['animations']>((acc, { key, flags }) => {
        if (!(flags & NODE_FIELD_FLAGS.Animatable)) return acc

        const json = this.animations[key]?.toJSON()
        if (json) {
          const result: any = acc ?? {}
          result[key] = json
          return result
        }
        return acc
      }, undefined),
      color: this.color,
      metadata: this.metadata,
    }
  }

  readonly isNode = true
  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  getLocalTimeOffset(): Rational {
    return Rational.ZERO
  }
  isTimeline(): this is pub.Timeline {
    return false
  }
  isTrack(): this is pub.AnyTrack {
    return false
  }
  isTrackChild(): this is pub.AnyClip {
    return false
  }
  isClip(): this is pub.AnyClip {
    return false
  }
  isMediaClip(): this is pub.AnyMediaClip {
    return false
  }
  isImageClip(): this is pub.ImageClip {
    return false
  }
  isTextClip(): this is pub.TextClip {
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
  _fieldsByKey<T extends pub.BaseNode>(this: T): Partial<Record<string, pub.NodeFieldDef<T>>> {
    return (this.constructor as typeof BaseNode).FIELDS_BY_KEY as any
  }

  _defineReactive<Key extends keyof T>(
    key: Extract<Exclude<Key, 'id' | 'type'>, string>,
    initialValue: T[Key],
    options: {
      equal?: (a: T[Key], b: T[Key]) => boolean
      transform?: (value: T[Key]) => T[Key]
      defaultValue?: T[Key]
      flags: number
    },
  ): void {
    const ref_ = (this.#refs[key] = ref(options.transform ? options.transform(initialValue) : initialValue))
    type This = typeof this
    const equal = options.equal ?? Object.is

    const getValueOrDefault = (): T[Key] | undefined => {
      const { value } = ref_
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- distinguishing null value
      return value === undefined ? options.defaultValue : value
    }

    let get

    if (options.flags & NODE_FIELD_FLAGS.Animatable) {
      const view = this._animationViews.get(key)!
      get = () => view.getValue() ?? getValueOrDefault()
    } else {
      get = getValueOrDefault
    }

    Object.defineProperty(this, key, {
      get,
      set(this: This, value_: T[Key]) {
        const { transform } = options
        const value = transform ? transform(value_) : value_

        const animation = this.animations[key]
        if (animation?.keyframes[0]) {
          animation.updateOrCreateAtTime(
            value,
            this.doc._currentFrameTime.value.subtract(this.getLocalTimeOffset()),
          )
          return
        }

        const prev = ref_.value
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
    if (this.isDisposed) return

    this.parent?._unlinkChild(this as any)
    this.doc.emit(new NodeDeleteEvent(this as unknown as pub.AnyNode))
    this.dispose()
  }

  dispose(): void {
    if (this.isDisposed) return
    this.isDisposed = true

    this._abort.abort()
    this.animationMap.forEach((animation) => animation.dispose())
    this._animationViews.forEach((view) => view.dispose())

    this.parent?._unlinkChild(this as any)
    ;(this as Partial<NonReadonly<typeof this>>).doc = undefined
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
