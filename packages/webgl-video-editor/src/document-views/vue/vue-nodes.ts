import * as Vue from 'vue'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'

import { NodeView } from '../node-view.ts'

import {
  _bindMethod,
  _vueNodeArrayProp,
  _vueNodeProp,
  _vuePlainReadonly,
  _vueWritable,
  type MethodKey,
} from './utils.ts'
import type { VueDocument } from './vue-document.ts'

const BASE_METHOD_KEYS = [
  'move',
  'remove',
  'isTimeline',
  'isTrack',
  'isClip',
  'isMediaClip',
  'isTextClip',
  'isVideo',
  'isAudio',
  'toJSON',
  '_fields',
] satisfies MethodKey<pub.BaseNode>[]

export class VueNodeView<T extends pub.AnyNode> extends NodeView<VueDocument, T> {
  constructor(docView: VueDocument, original: any) {
    super(docView, original)
    Vue.markRaw(this)

    this.original._fields().forEach(({ key, flags }) => {
      if (flags & NODE_FIELD_FLAGS.Node) _vueNodeProp(this, original, key)
      else if (flags & NODE_FIELD_FLAGS.NodeArray) _vueNodeArrayProp(this, original, key)
      else if (flags & NODE_FIELD_FLAGS.Readonly) _vuePlainReadonly(this, original, key)
      else _vueWritable(this, original, key)
    })

    BASE_METHOD_KEYS.forEach((key) => _bindMethod(this, original, key))
  }

  delete(deep?: boolean): void {
    this.original.delete(deep)
  }

  dispose(deep?: boolean): void {
    this.original.dispose(deep)
    super.dispose()
  }
}

export class VueParentNode<T extends pub.AnyParentNode> extends VueNodeView<T> {
  get children(): T['children'] {
    const array: T['children'] = []
    for (let current = (this as unknown as T).head; current; current = current.next)
      array.push(current as any)
    return array
  }
}

export interface VueTimeline extends VueParentNode<pub.Timeline>, pub.Timeline {}
export interface VueTrack extends VueParentNode<pub.Track>, pub.Track {}
export interface VueVideoClip extends VueNodeView<pub.VideoClip>, pub.VideoClip {}
export interface VueAudioClip extends VueNodeView<pub.AudioClip>, pub.AudioClip {}
export interface VueTextClip extends VueNodeView<pub.TextClip>, pub.TextClip {}
