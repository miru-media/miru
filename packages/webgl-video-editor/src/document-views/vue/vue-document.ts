import { createEffectScope } from 'fine-jsx'
import * as Vue from 'vue'

import type * as pub from '../../../types/webgl-video-editor'
import type { VideoEditor } from '../../video-editor.ts'
import { DocumentView, type ViewType } from '../document-view.ts'

import { _vuePlainReadonly, toVue } from './utils.ts'
import { VueAudioClip, VueGap, VueTimeline, VueTrack, VueVisualClip } from './vue-nodes.ts'

type EditorStaticProps = '_editor' | 'store' | 'canvas' | 'effectRenderer'
type EditorMethodProps =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed
  keyof { [P in keyof pub.VideoEditor as pub.VideoEditor[P] extends Function ? P : never]: unknown }
type EditorReactiveProps = Exclude<keyof pub.VideoEditor, EditorStaticProps | EditorMethodProps>

type VueVideoEditorRaw = {
  /** @internal @hidden */
  _editor: VideoEditor

  store?: pub.VideoEditorStore | undefined
} & {
  [P in EditorReactiveProps]: Vue.Ref<pub.VideoEditor[P]>
} & {
  [P in EditorStaticProps]:
    | (undefined extends pub.VideoEditor[P] ? undefined : never)
    | (pub.VideoEditor[P] & ReturnType<(typeof Vue)['markRaw']>)
} & {
  [P in EditorMethodProps]: pub.VideoEditor[P]
}

export interface VueTypeMap {
  timeline: VueTimeline
  track: VueTrack
  clip: VueVisualClip | VueAudioClip
  gap: VueGap
}

export class VueDocument extends DocumentView<VueTypeMap> implements pub.Document {
  readonly vueScope = Vue.effectScope()
  readonly fineJsxScope = createEffectScope()

  declare readonly resolution: pub.Document['resolution']
  declare readonly frameRate: pub.Document['frameRate']
  declare readonly currentTime: pub.Document['currentTime']
  declare readonly duration: pub.Document['duration']
  declare readonly timeline: pub.Document['timeline']
  declare readonly assets: pub.Document['assets']
  declare readonly nodes: pub.Document['nodes']
  declare readonly isEmpty: pub.Document['isEmpty']
  /** @internal */
  declare readonly activeClipIsStalled: pub.Document['activeClipIsStalled']

  constructor(options: { doc: pub.Document }) {
    super(options)
    Vue.markRaw(this)

    const { doc } = options
    ;(
      [
        'resolution',
        'frameRate',
        'currentTime',
        'duration',
        'timeline',
        'assets',
        'nodes',
        'isEmpty',
        'activeClipIsStalled',
      ] as const
    ).forEach((key) => _vuePlainReadonly(this, doc, key))

    this._init()
  }

  createNode = this.doc.createNode.bind(this.doc)
  createAsset = this.doc.createAsset.bind(this.doc)
  seekTo = this.doc.seekTo.bind(this.doc)
  _setCurrentTime = this.doc._setCurrentTime.bind(this.doc)
  importFromJson = this.doc.importFromJson.bind(this.doc)
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

export const editorToVue = (editor: VideoEditor): pub.VideoEditor => {
  const fineJsxScope = createEffectScope()
  const docView = new VueDocument(editor)

  return fineJsxScope.run(() =>
    Vue.reactive<VueVideoEditorRaw>({
      _editor: Vue.markRaw(editor),
      store: editor.store && Vue.markRaw(editor.store),
      canvas: editor.canvas,
      effectRenderer: Vue.markRaw(editor.effectRenderer),
      resolution: toVue(
        () => editor.doc.resolution,
        (value) => (editor.doc.resolution = value),
      ),
      frameRate: toVue(
        () => editor.doc.frameRate,
        (value) => (editor.doc.frameRate = value),
      ),
      isEmpty: toVue(() => editor.doc.isEmpty),
      isPaused: toVue(() => editor.playback.isPaused),
      currentTime: toVue(() => editor.currentTime),
      tracks: toVue(() => docView.timeline.children),
      selection: toVue(() => editor.selection && docView._getNode(editor.selection)),
      effects: toVue(() => editor.effects) as any,
      exportResult: toVue(() => editor.exportResult),
      state: toVue(() => editor.toObject()),

      play: editor.play.bind(editor),
      pause: editor.pause.bind(editor),
      seekTo: editor.seekTo.bind(editor),
      addClip: (track: pub.Track, source: string | Blob | pub.Schema.AnyClip) =>
        editor.addClip(editor.doc.nodes.get(track.id), source as any),
      select: (clip: pub.AnyClip | pub.Gap | undefined) => editor.select(clip?.id),
      async createMediaAsset(source: string | Blob) {
        return await editor.createMediaAsset(source)
      },
      splitClipAtCurrentTime() {
        const newClips = editor.splitClipAtCurrentTime()
        return newClips && [docView._getNode(newClips[0]), docView._getNode(newClips[1])]
      },
      replaceClipSource: editor.replaceClipSource.bind(editor),
      deleteSelection: editor.deleteSelection.bind(editor),
      importJson: editor.importJson.bind(editor),
      toObject: editor.toObject.bind(editor),
      export: editor.export.bind(editor),
      dispose(): void {
        fineJsxScope.stop()
        editor.dispose()
      },
      _showStats: toVue(editor._showStats),
    }),
  )
}
