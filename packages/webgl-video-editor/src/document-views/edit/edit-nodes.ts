import { computed, ref } from 'fine-jsx'

import type { AnyClip, AnyNode, AnyParentNode, AudioClip, ClipTime, Timeline, Track, VideoClip } from '#core'
import type { KeyofUnion } from '#internal'
import type { Clip, Gap } from '#nodes'

import { NodeUpdateEvent } from '../../events.ts'
import { NodeView } from '../node-view.ts'

import type { EditDocument } from './edit-document.ts'

declare module 'webgl-video-editor' {
  export interface BaseNode {
    readonly [IS_EDIT_VIEW]?: boolean
  }
}

const IS_EDIT_VIEW = '_is_edit_view'

const viewProxies = new WeakMap<EditView<any>, EditNodeProxy<AnyNode>>()

export class EditView<T extends AnyNode> extends NodeView<EditDocument, T> {
  static BOUND_METHODS = new Set<KeyofUnion<AnyNode | NodeView<EditDocument, any>>>([
    'delete',
    'dispose',
    'getSnapshot',
    'move',
    'remove',
  ])

  readonly [IS_EDIT_VIEW]? = true as boolean
  readonly _boundMethods: Record<string | symbol, (...args: unknown[]) => unknown>

  readonly _editedProps = ref<Partial<T> | undefined>()

  _isEnding = false

  _move = super._move.bind(this)
  _update = super._update.bind(this)

  _startEditing = this.#beginEdit.bind(this)
  _applyEdits = this.#end.bind(this, true)
  _dropEdits = this.#end.bind(this, false)

  constructor(editDoc: EditDocument, original: T) {
    super(editDoc, original)

    const Constructor = this.constructor as typeof EditView
    const methods: typeof this._boundMethods = {}

    Constructor.BOUND_METHODS.forEach((key) => {
      methods[key] = (original as unknown as typeof methods)[key].bind(original)
    })

    this._boundMethods = methods
  }

  #beginEdit(keys: (keyof T)[]): void {
    if (this._editedProps.value) throw new Error('Already editing node.')

    const { original } = this
    const obj: Partial<T> = {}
    keys.forEach((key) => void (obj[key] = original[key]))
    this._editedProps.value = obj
  }

  #end(shouldApply: boolean): void {
    if (this.isDisposed) return

    this._isEnding = true

    const editedProps = this._editedProps.value
    const { original, docView } = this

    for (const key in editedProps)
      if (Object.hasOwn(editedProps, key)) {
        const editValue = editedProps[key]

        if (shouldApply) (original as any)[key] = editValue
        else {
          const originalValue = (original as any)[key]

          if (JSON.stringify(originalValue) !== JSON.stringify(editValue))
            docView.emit(new NodeUpdateEvent(docView._getNode(original), key as any, editValue))
        }
      }

    this._editedProps.value = undefined
    this._isEnding = false
  }
}

const nodeHandler: ProxyHandler<EditView<AnyNode>> = {
  get(target, key, receiver) {
    const { original } = target

    switch (key) {
      case 'doc':
        return target.docView

      // node properties
      case 'prev':
      case 'next':
      case 'parent':
      case 'head':
      case 'tail':
        return target.docView._getNode((original as AnyParentNode)[key])

      // view properties and methods
      case '_move':
      case '_update':
      case '_startEditing':
      case '_applyEdits':
      case '_dropEdits':
      case '_editedProps':
      case '_isEnding':
        return target[key]

      // node array properties
      case 'children':
      case 'clips':
        return (original as Track)[key].map((node) => target.docView._getNode(node))

      // clip time properties and methods
      case 'time':
      case 'presentationTime':
      case 'playableTime':
      case '_computeTime':
      case '_computePresentationTime':
      case '_computePlayableTime':
        return Reflect.get(original, key, receiver)

      case '_time':
      case '_presentationTime':
      case '_playableTime':
        return (target as EditClip<any>)[key]

      case IS_EDIT_VIEW:
        return true
    }

    const boundMethod = (target._boundMethods as any)[key] as ((...args: any[]) => unknown) | undefined

    if (boundMethod) return boundMethod

    const editedProps = target._editedProps.value

    if (
      key === 'time' &&
      editedProps &&
      original.isTrackChild() &&
      ('sourceStart' in editedProps || 'duration' in editedProps)
    ) {
      const originalTime = Reflect.get(original, key, receiver)
      const { start } = originalTime
      const duration = editedProps.duration ?? originalTime.duration

      const editTime: ClipTime = {
        start,
        duration,
        source: 'sourceStart' in editedProps ? editedProps.sourceStart! : originalTime.source,
        end: start + duration,
      }

      return editTime
    }

    if (editedProps && key in editedProps) return editedProps[key as keyof typeof original]

    return Reflect.get(original, key, original)
  },
  set(target, key, value, receiver) {
    const editedProps: Record<string | symbol, unknown> | undefined = target._editedProps.value
    const { original } = target

    if (editedProps && key in editedProps) {
      const oldValue = editedProps[key]
      target._editedProps.value = { ...editedProps, [key]: value }
      target.docView._emit(new NodeUpdateEvent(receiver, key as any, oldValue))
      return true
    }

    return Reflect.set(original, key, value, original)
  },
  has(target, key) {
    return Reflect.has(target.original, key)
  },
  ownKeys(target) {
    const keys = Reflect.ownKeys(target.original)
    keys.push(IS_EDIT_VIEW)
    return keys
  },
  getPrototypeOf(target) {
    return Reflect.getPrototypeOf(target.original)
  },
}

export class EditClip<T extends AnyClip> extends EditView<T> {
  /* eslint-disable @typescript-eslint/unbound-method -- Reflect.apply */
  _time = computed(
    (): ClipTime =>
      Reflect.apply((this.original as unknown as Clip<T>)._computeTime, viewProxies.get(this), []),
  )
  _presentationTime = computed(
    (): ClipTime =>
      Reflect.apply(
        (this.original as unknown as Clip<T>)._computePresentationTime,
        viewProxies.get(this),
        [],
      ),
  )
  _playableTime = computed(
    (): ClipTime =>
      Reflect.apply((this.original as unknown as Clip<T>)._computePlayableTime, viewProxies.get(this), []),
  )
  /* eslint-enable @typescript-eslint/unbound-method */
}

export type EditNodeProxy<T extends AnyNode> = EditView<T> & T

export type EditTimeline = EditNodeProxy<Timeline>
export type EditTrack = EditNodeProxy<Track>
export type EditVideoClip = EditNodeProxy<VideoClip>
export type EditAudioClip = EditNodeProxy<AudioClip>
export type EditGap = EditNodeProxy<Gap>
export type AnyEditTrackChild = EditVideoClip | EditAudioClip | EditGap

export const createEditViewProxy = <T extends AnyNode>(
  view: EditView<T> | EditClip<any>,
): EditNodeProxy<T> => {
  const proxy = new Proxy<EditView<any>>(view, nodeHandler) as EditNodeProxy<T>
  viewProxies.set(view, proxy as any)
  return proxy
}
