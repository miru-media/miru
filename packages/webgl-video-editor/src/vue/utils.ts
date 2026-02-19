import { createEffectScope, EffectScope, type MaybeRefOrGetter } from 'fine-jsx'
import * as Vue from 'vue'

import * as interop from 'shared/utils/interop'

import type * as pub from '../../types/webgl-video-editor.ts'
import type * as nodes from '../nodes/index.ts'
import type { VideoEditor } from '../video-editor.ts'

type Mappings =
  | [nodes.Track, pub.Track]
  | [nodes.Clip, pub.Clip]
  | [nodes.BaseClip, pub.Clip]
  | [nodes.MediaAsset, pub.MediaAsset]
  | [nodes.VideoEffectAsset, pub.VideoEffectAsset]

type PublicToVueOrSameType<T> =
  | (undefined extends T ? undefined : never)
  | (T extends Mappings[0]
      ? Extract<Mappings, [T, unknown]>[1]
      : T extends Mappings[0][]
        ? Extract<Mappings, [T, unknown]>[1][]
        : T)

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
  [P in EditorReactiveProps]: Vue.Ref<PublicToVueOrSameType<pub.VideoEditor[P]>>
} & {
  [P in EditorStaticProps]:
    | (undefined extends pub.VideoEditor[P] ? undefined : never)
    | (PublicToVueOrSameType<pub.VideoEditor[P]> & ReturnType<(typeof Vue)['markRaw']>)
} & {
  [P in EditorMethodProps]: PublicToVueOrSameType<pub.VideoEditor[P]>
}

export const toVue = interop.toVue.bind(null, Vue.customRef, Vue.onScopeDispose) as <T>(
  source: MaybeRefOrGetter<T>,
  set?: (newValue: T) => void,
) => Vue.Ref<T>
export const fromVue = interop.fromVue.bind(null, Vue.toValue, Vue.watchEffect) as <T>(
  source: MaybeRefOrGetter<T>,
) => Vue.Ref<T>

export const editorToVue = (editor: VideoEditor): pub.VideoEditor => {
  const fineJsxScope = createEffectScope()
  const nodeMap = new WeakMap<Mappings[0], Mappings[1]>()

  const getVueNode = <T extends Mappings[0]>(node: T): Extract<Mappings, [T, unknown]>[1] => {
    let vueNode = nodeMap.get(node) as Extract<Mappings, [T, unknown]>[1] | undefined

    if (!vueNode) {
      let newVueNode!: Mappings[1]

      const scope = new EffectScope(true)
      let reactiveValue

      const getWritableProp = (node: any, key: string) =>
        toVue(
          () => node[key],
          (value) => (node[key] = value),
        )

      scope.run(() => {
        switch (node.type) {
          case 'track':
            reactiveValue = Vue.reactive({
              ...node.toObject(),
              children: toVue(() => node.children.map(getVueNode)),
              dispose: node.dispose.bind(node),
            })
            break
          case 'clip':
            reactiveValue = Vue.reactive({
              id: node.id,
              type: node.type,
              source: getWritableProp(node, 'source'),
              start: getWritableProp(node, 'start'),
              duration: getWritableProp(node, 'duration'),
              sourceStart: getWritableProp(node, 'sourceStart'),
              filter: getWritableProp(node, 'filter'),
              get prev() {
                return node.prev && getVueNode(node.prev)
              },
              get next() {
                return node.next && getVueNode(node.next)
              },
              get parent() {
                return node.parent && getVueNode(node.parent)
              },
              _presentationTime: toVue(() => node.presentationTime),
              dispose: node.dispose.bind(node),
            })
            break
          case 'asset:media:av':
            reactiveValue = Vue.reactive({
              ...node.toObject(),
              blob: toVue(() => node.blob) as unknown as Blob,
              dispose: node.dispose.bind(node),
            })
            break
          case 'asset:effect:video':
            reactiveValue = Vue.reactive({
              ...node.toObject(),
              raw: node.raw,
              dispose: node.dispose.bind(node),
            })
            break
        }

        newVueNode = reactiveValue
      })

      node.onDispose(scope.stop.bind(scope))

      vueNode = newVueNode as NonNullable<typeof vueNode>
      nodeMap.set(node, vueNode)
    }

    return vueNode
  }

  return fineJsxScope.run(() =>
    Vue.reactive<VueVideoEditorRaw>({
      _editor: Vue.markRaw(editor),
      store: editor.store && Vue.markRaw(editor.store),
      canvas: editor.canvas,
      effectRenderer: Vue.markRaw(editor.effectRenderer),
      resolution: toVue(
        () => editor._movie.resolution,
        (value) => (editor._movie.resolution = value),
      ),
      frameRate: toVue(
        () => editor._movie.frameRate,
        (value) => (editor._movie.frameRate = value),
      ),
      isEmpty: toVue(() => editor._movie.isEmpty),
      isPaused: toVue(() => editor._movie.isPaused.value),
      currentTime: toVue(() => editor.currentTime),
      tracks: toVue(() => editor.tracks.map(getVueNode)),
      selection: toVue(() => editor.selection && getVueNode(editor.selection)),
      effects: toVue(() => editor.effects as Map<string, pub.VideoEffectAsset>) as any,
      exportResult: toVue(() => editor.exportResult),
      state: toVue(() => editor.toObject()),

      play: editor.play.bind(editor),
      pause: editor.pause.bind(editor),
      seekTo: editor.seekTo.bind(editor),
      addClip: (track: pub.Track, source: string | Blob | pub.Schema.Clip) =>
        editor.addClip(editor._movie.nodes.get(track.id), source as any),
      selectClip: (clip: pub.Clip | undefined) => editor.selectClip(clip?.id),
      async createMediaAsset(source: string | Blob) {
        return getVueNode(await editor.createMediaAsset(source))
      },
      splitClipAtCurrentTime() {
        const newClip = editor.splitClipAtCurrentTime()
        return newClip && getVueNode(newClip)
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
