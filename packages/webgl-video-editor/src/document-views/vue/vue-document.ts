import { createEffectScope } from 'fine-jsx'
import * as Vue from 'vue'

import type * as pub from '#core'

import { DocumentView, type ViewType } from '../document-view.ts'

import { _vuePlainReadonly, _vueWritable } from './utils.ts'
import { VueAudioClip, VueGap, VueTimeline, VueTrack, VueVisualClip } from './vue-nodes.ts'

export interface VueTypeMap {
  timeline: VueTimeline
  track: VueTrack
  clip: VueVisualClip | VueAudioClip
  gap: VueGap
}

export class VueDocument extends DocumentView<VueTypeMap> implements pub.Document {
  readonly vueScope = Vue.effectScope()
  readonly fineJsxScope = createEffectScope()

  declare resolution: pub.Document['resolution']
  declare frameRate: pub.Document['frameRate']
  declare readonly currentTime: pub.Document['currentTime']
  declare readonly duration: pub.Document['duration']
  declare readonly timeline: pub.Document['timeline']
  declare readonly assets: pub.Document['assets']
  declare readonly nodes: pub.Document['nodes']
  declare readonly isEmpty: pub.Document['isEmpty']
  /** @internal */
  declare readonly activeClipIsStalled: pub.Document['activeClipIsStalled']

  constructor(options: { doc: pub.Document }) {
    const { doc } = options
    super(doc)

    Vue.markRaw(this)
    Vue.markRaw(doc)
    ;(['resolution', 'frameRate'] as const).forEach((key) => _vueWritable(this, doc, key))
    ;(
      ['currentTime', 'duration', 'timeline', 'assets', 'nodes', 'isEmpty', 'activeClipIsStalled'] as const
    ).forEach((key) => _vuePlainReadonly(this, doc, key))

    this._init()
  }

  createNode = this.doc.createNode.bind(this.doc)
  seekTo = this.doc.seekTo.bind(this.doc)
  _setCurrentTime = this.doc._setCurrentTime.bind(this.doc)
  importFromJson = this.doc.importFromJson.bind(this.doc)
  toObject = this.doc.toObject.bind(this.doc)
  on = this.doc.on.bind(this.doc)
  emit = this.doc.emit.bind(this.doc)

  protected _createView<T extends pub.AnyNode>(original: T): ViewType<VueTypeMap, T> {
    return this.vueScope.run(() => this.#createWithScope(original))!
  }

  #createWithScope<T extends pub.AnyNode>(original: T): ViewType<VueTypeMap, T> {
    let view

    switch (original.type) {
      case 'timeline':
        view = new VueTimeline(this, original)
        break
      case 'track':
        view = new VueTrack(this, original)
        break
      case 'clip': {
        const clip = original as unknown as pub.AnyClip
        view = clip.isVisual() ? new VueVisualClip(this, clip) : new VueAudioClip(this, clip)
        break
      }
      case 'gap':
        view = new VueGap(this, original)
    }

    return view as ViewType<VueTypeMap, T>
  }

  dispose(): void {
    this.doc.dispose()
    super.dispose()
  }
}
