import * as Vue from 'vue'

import type * as pub from '../../../types/core'
import type { ViewType } from '../document-view.ts'
import { NodeView } from '../node-view.ts'

import {
  _bindMethod,
  _vueNodeReadonly,
  _vuePlainReadonly,
  _vueWritable,
  type MethodKey,
  type NonMethodKey,
} from './utils.ts'
import type { VueDocument, VueTypeMap } from './vue-document.ts'

const BASE_PROP_KEYS = ['doc', 'parent', 'prev', 'next', 'index'] satisfies (keyof pub.BaseNode)[]
const BASE_METHOD_KEYS = [
  'move',
  'remove',
  'isTimeline',
  'isTrack',
  'isClip',
  'isGap',
  'isVisual',
  'isAudio',
  'toObject',
  'getSnapshot',
] satisfies MethodKey<pub.BaseNode>[]

interface PropKeysOption<T extends pub.AnyNode> {
  writable: NonMethodKey<T>[]
  readonly: NonMethodKey<T>[]
  methods: MethodKey<T>[]
}

abstract class VueNodeView<T extends pub.AnyNode> extends NodeView<VueDocument, T> implements pub.BaseNode {
  readonly doc = this.docView
  readonly id: T['id'] = this.original.id
  readonly type: T['type'] = this.original.type

  declare parent: ViewType<VueTypeMap, T['parent']>
  declare prev: ViewType<VueTypeMap, T['prev']>
  declare next: ViewType<VueTypeMap, T['next']>
  declare index: T['index']

  declare move: T['move']
  declare remove: T['remove']
  declare isTimeline: T['isTimeline']
  declare isTrack: T['isTrack']
  declare isClip: T['isClip']
  declare isGap: T['isGap']
  declare isVisual: T['isVisual']
  declare isAudio: T['isAudio']
  declare toObject: T['toObject']
  declare getSnapshot: T['getSnapshot']

  constructor(docView: VueDocument, original: any, propKeys: PropKeysOption<T>) {
    super(docView, original)
    Vue.markRaw(this)

    _vueNodeReadonly(this, original, 'parent')
    _vueNodeReadonly(this, original, 'prev')
    _vueNodeReadonly(this, original, 'next')

    _vuePlainReadonly(this, original, 'index')

    BASE_PROP_KEYS.forEach((key) => _vuePlainReadonly(this, original, key))
    BASE_METHOD_KEYS.forEach((key) => _bindMethod(this, original, key))

    const { writable, readonly, methods } = propKeys
    writable.forEach((key) => _vueWritable(this, original, key))
    readonly.forEach((key) => _vuePlainReadonly(this, original, key))
    methods.forEach((key) => _bindMethod(this, original, key))
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

  constructor(docView: VueDocument, original: pub.AnyParentNode, propKeys: PropKeysOption<T>) {
    super(docView, original, propKeys)

    _vueNodeReadonly(this, original, 'head')
    _vueNodeReadonly(this, original, 'tail')
  }
}

export class VueTimeline extends VueParentNode<pub.Timeline> implements pub.Timeline {
  declare readonly trackCount: pub.Timeline['trackCount']

  constructor(docView: VueDocument, original: pub.Timeline) {
    super(docView, original, { writable: [], readonly: [], methods: [] })
  }
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
    super(docView, original, { writable: [], readonly: ['clipCount', 'duration'], methods: [] })
    _vueNodeReadonly(this, original, 'firstClip')
    _vueNodeReadonly(this, original, 'lastClip')
  }
}

abstract class VueTrackChild<T extends pub.AnyTrackChild> extends VueNodeView<T> implements pub.TrackChild {
  declare readonly time: T['time']
  declare duration: T['duration']

  constructor(docView: VueDocument, original: T, propKeys: PropKeysOption<T>) {
    const writable = [...propKeys.writable, 'duration'] satisfies (keyof T)[]
    const readonly = [...propKeys.readonly, 'time'] satisfies (keyof T)[]
    super(docView, original, {
      ...propKeys,
      writable: writable as any[],
      readonly: readonly as any[],
    })
  }
}

abstract class VueClip<T extends pub.AnyClip> extends VueTrackChild<T> implements pub.Clip<T> {
  declare readonly isReady: T['isReady']
  declare readonly sourceAsset: T['sourceAsset']
  declare readonly playableTime: T['playableTime']
  declare readonly presentationTime: T['presentationTime']
  declare readonly expectedMediaTime: T['expectedMediaTime']
  declare readonly isInClipTime: T['isInClipTime']
  declare readonly clipType: T['clipType']
  declare readonly sourceStart: T['sourceStart']
  declare readonly source: T['source']

  constructor(docView: VueDocument, original: T, propKeys: PropKeysOption<T>) {
    const readonly = [
      'isReady',
      'sourceAsset',
      'playableTime',
      'presentationTime',
      'expectedMediaTime',
      'isInClipTime',
      ...propKeys.readonly,
    ] satisfies (keyof T)[]

    super(docView, original, {
      ...propKeys,
      readonly: readonly as any[],
    })
  }
}

export class VueVisualClip extends VueClip<pub.VisualClip> implements pub.VisualClip {
  declare readonly position: pub.VisualClip['position']
  declare readonly rotation: pub.VisualClip['rotation']
  declare readonly scale: pub.VisualClip['scale']

  constructor(docView: VueDocument, original: pub.VisualClip) {
    super(docView, original, {
      writable: ['position', 'rotation', 'scale', 'sourceStart', 'source'],
      readonly: ['clipType'],
      methods: [],
    })
  }
}

export class VueAudioClip extends VueClip<pub.AudioClip> implements pub.AudioClip {
  declare readonly volume: pub.AudioClip['volume']
  declare readonly mute: pub.AudioClip['mute']

  constructor(docView: VueDocument, original: pub.AudioClip) {
    super(docView, original, {
      writable: ['volume', 'mute'],
      readonly: [],
      methods: [],
    })
  }
}

export class VueGap extends VueNodeView<pub.Gap> implements pub.Gap {
  declare readonly time: pub.Gap['time']
  declare readonly duration: pub.Gap['duration']

  constructor(docView: VueDocument, original: pub.Gap) {
    super(docView, original, { writable: [], readonly: [], methods: [] })
  }
}
