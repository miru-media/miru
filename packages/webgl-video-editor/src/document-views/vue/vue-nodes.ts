import * as Vue from 'vue'

import type * as pub from '../../../types/core'
import type { ViewType } from '../document-view.ts'
import { NodeView } from '../node-view.ts'

import { _bindMethod, _vueNodeReadonly, _vuePlainReadonly, _vueWritable, type MethodKey } from './utils.ts'
import type { VueDocument, VueTypeMap } from './vue-document.ts'

const BASE_PROP_KEYS = ['doc', 'parent', 'prev', 'next', 'index'] satisfies (keyof pub.BaseNode)[]
const BASE_METHOD_KEYS = [
  'move',
  'remove',
  'isTimeline',
  'isTrack',
  'isClip',
  'isGap',
  'isVideo',
  'isAudio',
  'toJSON',
  'getSnapshot',
] satisfies MethodKey<pub.BaseNode>[]

abstract class VueNodeView<T extends pub.AnyNode> extends NodeView<VueDocument, T> implements pub.BaseNode {
  readonly doc = this.docView
  readonly id: T['id'] = this.original.id
  readonly type: T['type'] = this.original.type

  declare parent: ViewType<VueTypeMap, T['parent']>
  declare prev: ViewType<VueTypeMap, T['prev']>
  declare next: ViewType<VueTypeMap, T['next']>
  declare index: T['index']
  declare name: T['name']
  declare enabled: T['enabled']
  declare effects: T['effects']
  declare color: pub.Schema.Base['color']

  declare move: T['move']
  declare remove: T['remove']
  declare isTimeline: T['isTimeline']
  declare isTrack: T['isTrack']
  declare isTrackChild: T['isTrackChild']
  declare isClip: T['isClip']
  declare isGap: T['isGap']
  declare isVideo: T['isVideo']
  declare isAudio: T['isAudio']
  declare toJSON: T['toJSON']
  declare getSnapshot: T['getSnapshot']

  constructor(docView: VueDocument, original: any) {
    super(docView, original)
    Vue.markRaw(this)

    _vueNodeReadonly(this, original, 'parent')
    _vueNodeReadonly(this, original, 'prev')
    _vueNodeReadonly(this, original, 'next')

    _vuePlainReadonly(this, original, 'index')
    ;(['name', 'enabled', 'effects', 'markers', 'color', 'metadata'] satisfies (keyof T)[]).forEach((key) =>
      _vueWritable(this, original, key),
    )

    BASE_PROP_KEYS.forEach((key) => _vuePlainReadonly(this, original, key))
    BASE_METHOD_KEYS.forEach((key) => _bindMethod(this, original, key))
  }

  delete(): void {
    this.original.delete()
  }

  dispose(): void {
    if (!this.original.isDisposed) this.original.dispose()
    super.dispose()
  }
}

abstract class VueParentNode<T extends pub.AnyParentNode>
  extends VueNodeView<T>
  implements pub.ParentNode<T['children'][number]>
{
  declare _unlinkChild: never
  declare _positionChildAt: never
  getSnapshot = this.original.getSnapshot.bind(this.original)

  declare readonly head: T['head']
  declare readonly tail: T['tail']

  get children(): T['children'] {
    const array: T['children'] = []
    for (let current = this.head; current; current = current.next) array.push(current as any)
    return array
  }

  constructor(docView: VueDocument, original: pub.AnyParentNode) {
    super(docView, original)

    _vueNodeReadonly(this, original, 'head')
    _vueNodeReadonly(this, original, 'tail')
  }
}

export class VueTimeline extends VueParentNode<pub.Timeline> implements pub.Timeline {
  declare readonly trackCount: pub.Timeline['trackCount']
}

export class VueTrack extends VueParentNode<pub.Track> implements pub.Track {
  declare readonly clipCount: pub.Track['clipCount']
  declare readonly trackType: pub.Track['trackType']
  declare readonly duration: pub.Track['duration']
  declare readonly firstClip: pub.Track['firstClip']
  declare readonly lastClip: pub.Track['lastClip']

  get clips(): pub.Track['clips'] {
    const clips: pub.Track['clips'] = []
    for (let clip = this.firstClip; clip; clip = clip.nextClip) clips.push(clip)
    return clips
  }

  constructor(docView: VueDocument, original: pub.Track) {
    super(docView, original)
    _vueNodeReadonly(this, original, 'firstClip')
    _vueNodeReadonly(this, original, 'lastClip')

    _vuePlainReadonly(this, original, 'clipCount')
    _vuePlainReadonly(this, original, 'duration')
  }
}

abstract class VueTrackChild<T extends pub.AnyTrackChild> extends VueNodeView<T> implements pub.TrackChild {
  declare readonly timeRational: T['timeRational']
  declare readonly time: T['time']
  declare duration: T['duration']

  constructor(docView: VueDocument, original: T) {
    super(docView, original)

    _vueWritable(this, original, 'duration')
    _vuePlainReadonly(this, original, 'timeRational')
    _vuePlainReadonly(this, original, 'time')
  }
}

abstract class VueClip<T extends pub.AnyClip> extends VueTrackChild<T> implements pub.Clip<T> {
  declare readonly isReady: T['isReady']
  declare readonly asset: T['asset']
  declare readonly playableTime: T['playableTime']
  declare readonly presentationTime: T['presentationTime']
  declare readonly expectedMediaTime: T['expectedMediaTime']
  declare readonly isInClipTime: T['isInClipTime']
  declare readonly clipType: T['clipType']
  declare readonly sourceStart: T['sourceStart']
  declare readonly mediaRef: T['mediaRef']

  constructor(docView: VueDocument, original: T) {
    super(docView, original)

    const writable = ['sourceStart'] satisfies (keyof T)[]
    const readonly = [
      'isReady',
      'asset',
      'playableTime',
      'presentationTime',
      'expectedMediaTime',
      'isInClipTime',
    ] satisfies (keyof T)[]

    writable.forEach((key) => _vueWritable(this, original, key))
    readonly.forEach((key) => _vuePlainReadonly(this, original, key))
  }
}

export class VueVideoClip extends VueClip<pub.VideoClip> implements pub.VideoClip {
  declare readonly translate: pub.VideoClip['translate']
  declare readonly rotate: pub.VideoClip['rotate']
  declare readonly scale: pub.VideoClip['scale']
  declare readonly effects: pub.VideoClip['effects']

  constructor(docView: VueDocument, original: pub.VideoClip) {
    super(docView, original)
    ;(['translate', 'rotate', 'scale', 'effects'] as const).forEach((key) =>
      _vueWritable(this, original, key),
    )
    _vuePlainReadonly(this, original, 'clipType')
  }
}

export class VueAudioClip extends VueClip<pub.AudioClip> implements pub.AudioClip {
  declare readonly volume: pub.AudioClip['volume']
  declare readonly enabled: pub.AudioClip['enabled']

  constructor(docView: VueDocument, original: pub.AudioClip) {
    super(docView, original)
    _vueWritable(this, original, 'volume')
  }
}

export class VueGap extends VueTrackChild<pub.Gap> implements pub.Gap {}
