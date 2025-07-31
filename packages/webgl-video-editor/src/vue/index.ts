import { createEffectScope, EffectScope, type MaybeRefOrGetter, type Ref } from 'fine-jsx'
import * as Vue from 'vue'

import * as interop from 'shared/utils/interop'
import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import type * as nodes from '../nodes/index.ts'
import { VideoEditor as VideoEditor_ } from '../video-eidtor.ts'

export type { VideoEditor } from '../../types/webgl-video-editor.ts'

export * from '../constants.ts'

type Mappings =
  | [nodes.Track<nodes.Clip>, pub.Track]
  | [nodes.Clip, pub.Clip]
  | [nodes.MediaAsset, pub.MediaAsset]

type PublicToVueOrSameType<T> = T extends Mappings[0]
  ? Extract<Mappings, [T, unknown]>[1]
  : T extends Mappings[0][]
    ? Extract<Mappings, [T, unknown]>[1][]
    : T

const toVue = interop.toVue.bind(null, Vue.customRef, Vue.onScopeDispose) as <T>(
  source: MaybeRefOrGetter<T>,
  set?: (newValue: T) => void,
) => Vue.Ref<T>
const fromVue = interop.fromVue.bind(null, Vue.toValue, Vue.watchEffect) as <T>(
  source: Vue.MaybeRefOrGetter<T>,
) => Ref<T>

type EditorStaticProps = 'canvas' | 'renderer'
type EditorMethodProps =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- needed
  keyof { [P in keyof pub.VideoEditor as pub.VideoEditor[P] extends Function ? P : never]: unknown }
type EditorReactiveProps = Exclude<keyof pub.VideoEditor, EditorStaticProps | EditorMethodProps>

type VueVideoEditorRaw = {
  [P in EditorReactiveProps]: Vue.Ref<PublicToVueOrSameType<pub.VideoEditor[P]>>
} & {
  [P in EditorStaticProps]: PublicToVueOrSameType<pub.VideoEditor[P]> & ReturnType<(typeof Vue)['markRaw']>
} & {
  [P in EditorMethodProps]: PublicToVueOrSameType<pub.VideoEditor[P]>
}

export default Vue.defineComponent({
  name: 'VideoEditor',
  props: {
    messages: { type: Object as Vue.PropType<Record<string, Record<string, string>>>, required: false },
    languages: { type: Array as Vue.PropType<string[]>, required: false },
  },
  emits: ['error'],
  setup(props, ctx) {
    const fineJsxScope = createEffectScope()
    const editor = new VideoEditor_()
    const container = Vue.ref<HTMLElement>()

    const nodeMap = new WeakMap<Mappings[0], Mappings[1]>()

    const getVueNode = <T extends Mappings[0]>(node: T): Extract<Mappings, [T, unknown]>[1] => {
      let vueNode = nodeMap.get(node) as Extract<Mappings, [T, unknown]>[1] | undefined

      if (!vueNode) {
        let newVueNode!: Mappings[1]

        const scope = new EffectScope(true)

        scope.run(() => {
          switch (node.type) {
            case 'track':
              newVueNode = Vue.reactive({
                id: node.id,
                trackType: node.trackType,
                children: toVue(() => node.children.map(getVueNode)),
              })
              break
            case 'clip':
              newVueNode = Vue.reactive({
                id: node.id,
                start: toVue(() => node.start),
                duration: toVue(() => node.duration),
                sourceStart: toVue(() => node.sourceStart),
                filter: toVue(() => node.filter),
                get prev() {
                  return node.prev && getVueNode(node.prev)
                },
                get next() {
                  return node.next && getVueNode(node.next)
                },
                get parent() {
                  return getVueNode(node.parent)
                },
                _presentationTime: toVue(() => node.presentationTime),
              })
              break
            case 'av_media_asset':
              newVueNode = Vue.reactive({
                id: node.id,
                name: node.name,
                duration: node.duration,
                blob: toVue(() => node.blob) as unknown as Blob,
                dispose: node.dispose.bind(node),
              })
              break
          }
        })

        node.onDispose(scope.stop.bind(scope))

        vueNode = newVueNode as NonNullable<typeof vueNode>
        nodeMap.set(node, vueNode)
      }

      return vueNode
    }

    const vueEditor: pub.VideoEditor = fineJsxScope.run(() =>
      Vue.reactive<VueVideoEditorRaw>({
        canvas: editor.canvas,
        renderer: Vue.markRaw(editor.renderer),
        resolution: toVue(
          () => editor._movie.resolution,
          (value) => (editor._movie.resolution = value),
        ),
        frameRate: toVue(editor._movie.frameRate),
        isEmpty: toVue(() => editor._movie.isEmpty),
        isPaused: toVue(() => editor._movie.isPaused.value),
        currentTime: toVue(() => editor.currentTime),
        tracks: toVue(() => editor.tracks.map(getVueNode)),
        selection: toVue(() => editor.selection),
        isLoading: toVue(() => editor.isLoading),
        canUndo: toVue(() => editor.canUndo),
        canRedo: toVue(() => editor.canRedo),
        effects: toVue(() => editor.effects),
        exportResult: toVue(() => editor.exportResult),
        state: toVue(() => editor.toObject()),

        play: editor.play.bind(editor),
        pause: editor.pause.bind(editor),
        seekTo: editor.seekTo.bind(editor),
        addClip: (track: pub.Track, source: string | Blob) =>
          editor.addClip(editor._movie.nodes.get(track.id), source),
        selectClip: (clip: pub.Clip | undefined) => editor.selectClip(clip?.id),
        async createMediaAsset(source: string | Blob) {
          return getVueNode(await editor.createMediaAsset(source))
        },
        splitClipAtCurrentTime() {
          const newClip = editor.splitClipAtCurrentTime()
          return newClip && getVueNode(newClip)
        },
        replaceClipSource: editor.replaceClipSource.bind(editor),
        setClipFilter: editor.setClipFilter.bind(editor) as pub.VideoEditor['setClipFilter'],
        deleteSelection: editor.deleteSelection.bind(editor),
        undo: editor.undo.bind(editor),
        redo: editor.redo.bind(editor),
        clearAllContentAndHistory: editor.clearAllContentAndHistory.bind(editor),
        replaceContent: editor.replaceContent.bind(editor),
        toObject: editor.toObject.bind(editor),
        export: editor.export.bind(editor),
        dispose(): void {
          fineJsxScope.stop()
          editor.dispose()
        },
        _showStats: toVue(editor._showStats),
      }),
    )

    Vue.watch(container, (host, _prev, onCleanup) => {
      if (!host) return

      const stop = renderComponentTo(
        VideoEditorUI,
        {
          editor,
          i18n: {
            messages: fromVue(() => props.messages ?? {}),
            languages: fromVue(() => props.languages ?? []),
          },
        },
        host,
      )

      onCleanup(stop)
    })

    ctx.expose(vueEditor)

    const { h } = Vue
    return () => h('div', { ...ctx.attrs, ref: container }, ctx.slots)
  },
})
