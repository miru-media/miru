import { createEffectScope } from 'fine-jsx'
import * as Vue from 'vue'

import type * as pub from '#core'

import { toVue } from '../document-views/vue/utils.ts'
import { VueDocument } from '../document-views/vue/vue-document.ts'

import { VueSelection } from './selection.ts'

type EditorStaticProps = '_editor' | 'doc' | 'sync' | 'canvas' | 'effectRenderer' | 'selection'
type EditorMethodProps =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed
  keyof { [P in keyof pub.VideoEditor as pub.VideoEditor[P] extends Function ? P : never]: unknown }
type EditorReactiveProps = Exclude<keyof pub.VideoEditor, EditorStaticProps | EditorMethodProps>

type VueVideoEditorRaw = {
  sync?: pub.VideoEditorDocumentSync | undefined
} & {
  [P in EditorReactiveProps]: Vue.Ref<pub.VideoEditor[P]>
} & {
  [P in EditorStaticProps]:
    | (undefined extends pub.VideoEditor[P] ? undefined : never)
    | (pub.VideoEditor[P] & ReturnType<(typeof Vue)['markRaw']>)
} & {
  [P in EditorMethodProps]: pub.VideoEditor[P]
}

export const editorToVue = (editor: pub.VideoEditor, ownsEditor: boolean): pub.VideoEditor => {
  const fineJsxScope = createEffectScope()
  const docView = new VueDocument(editor)
  const selection = new VueSelection(docView, editor.selection)

  return fineJsxScope.run(() =>
    Vue.reactive<VueVideoEditorRaw>({
      _editor: Vue.markRaw(editor._editor),
      doc: docView,
      sync: editor.sync && Vue.markRaw(editor.sync),
      canvas: editor.canvas,
      effectRenderer: Vue.markRaw(editor.effectRenderer),
      currentTime: toVue(() => editor.currentTime),
      tracks: toVue(() => docView.timeline.children),
      selection,
      effects: toVue(() => editor.effects),
      exportProgress: toVue(() => editor.exportProgress),
      viewportContainerSize: toVue(() => editor.viewportContainerSize),
      viewportSize: toVue(() => editor.viewportSize),
      isMobileWorkspace: toVue(() => editor.isMobileWorkspace),
      canvasZoom: toVue(() => editor.canvasZoom),
      timelineZoom: toVue(() => editor.timelineZoom),
      playback: toVue(() => editor.playback),
      _showStats: toVue(
        () => editor._showStats,
        (value) => (editor._showStats = value),
      ),
      activeAssetBin: toVue(
        () => editor.activeAssetBin,
        (value) => (editor.activeAssetBin = value),
      ),

      seekTo: editor.seekTo.bind(editor),
      createClipInitWithAsset: editor.createClipInitWithAsset.bind(editor),
      addMediaClip: (asset: pub.MediaAsset) => docView._getNode(editor.addMediaClip(asset)),
      async createMediaAsset(source: string | Blob) {
        return await editor.createMediaAsset(source)
      },
      splitClip(clip: pub.AnyClip, time: number) {
        const newClips = editor.splitClip(clip, time)
        return newClips && [docView._getNode(newClips[0]), docView._getNode(newClips[1])]
      },
      replaceClipAsset: editor.replaceClipAsset.bind(editor),
      action: editor.action.bind(editor),
      importJson: editor.importJson.bind(editor),
      export: editor.export.bind(editor),
      secondsToPixels: editor.secondsToPixels.bind(editor),
      pixelsToSeconds: editor.pixelsToSeconds.bind(editor),
      addTrack: editor.addTrack.bind(editor),
      generateId: editor.generateId.bind(editor),
      getPartId: editor.getPartId.bind(editor),

      dispose(): void {
        fineJsxScope.stop()
        selection.dispose()
        if (ownsEditor) editor.dispose()
      },
      [Symbol.dispose](): void {
        this.dispose()
      },
    }),
  )
}
