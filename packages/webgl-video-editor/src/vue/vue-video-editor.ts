import { createEffectScope } from 'fine-jsx'
import * as Vue from 'vue'

import type * as pub from '#core'

import { toVue } from '../document-views/vue/utils.ts'
import { VueDocument } from '../document-views/vue/vue-document.ts'

type EditorStaticProps = 'doc' | 'store' | 'canvas' | 'effectRenderer'
type EditorMethodProps =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed
  keyof { [P in keyof pub.VideoEditor as pub.VideoEditor[P] extends Function ? P : never]: unknown }
type EditorReactiveProps = Exclude<keyof pub.VideoEditor, EditorStaticProps | EditorMethodProps>

type VueVideoEditorRaw = {
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

export const editorToVue = (editor: pub.VideoEditor): pub.VideoEditor => {
  const fineJsxScope = createEffectScope()
  const docView = new VueDocument(editor)

  return fineJsxScope.run(() =>
    Vue.reactive<VueVideoEditorRaw>({
      doc: docView,
      store: editor.store && Vue.markRaw(editor.store),
      canvas: editor.canvas,
      effectRenderer: Vue.markRaw(editor.effectRenderer),
      currentTime: toVue(() => editor.currentTime),
      tracks: toVue(() => docView.timeline.children),
      selection: toVue(() => editor.selection && docView._getNode(editor.selection)),
      effects: toVue(() => editor.effects),
      exportResult: toVue(() => editor.exportResult),
      state: toVue(() => editor.toObject()),
      exportProgress: toVue(() => editor.exportProgress),
      viewportSize: toVue(() => editor.viewportSize),
      zoom: toVue(() => editor.zoom),
      playback: toVue(() => editor.playback),
      _timelineSize: toVue(() => editor._timelineSize),
      _secondsPerPixel: toVue(() => editor._secondsPerPixel),
      _showStats: toVue(editor._showStats),

      seekTo: editor.seekTo.bind(editor),
      addClip: (track: pub.Track, asset: pub.MediaAsset) =>
        editor.addClip(editor.doc.nodes.get(track.id), asset),
      select: (clip: pub.AnyClip | pub.Gap | undefined) =>
        editor.select(clip && editor.doc.nodes.get<pub.AnyTrackChild>(clip.id)),
      async createMediaAsset(source: string | Blob) {
        return await editor.createMediaAsset(source)
      },
      splitClipAtCurrentTime() {
        const newClips = editor.splitClipAtCurrentTime()
        return newClips && [docView._getNode(newClips[0]), docView._getNode(newClips[1])]
      },
      replaceClipAsset: editor.replaceClipAsset.bind(editor),
      deleteSelection: editor.deleteSelection.bind(editor),
      importJson: editor.importJson.bind(editor),
      toObject: editor.toObject.bind(editor),
      export: editor.export.bind(editor),
      secondsToPixels: editor.secondsToPixels.bind(editor),
      pixelsToSeconds: editor.pixelsToSeconds.bind(editor),
      addTrack: editor.addTrack.bind(editor),

      dispose(): void {
        fineJsxScope.stop()
        editor.dispose()
      },
      [Symbol.dispose](): void {
        this.dispose()
      },
    }),
  )
}
