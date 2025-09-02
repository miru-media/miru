import * as Vue from 'vue'

import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import { VideoEditorLocalStore as VideoEditorLocalStore_ } from '../store/local.ts'
import { VideoEditor as VideoEditor_ } from '../video-editor.ts'

import { editorToVue, fromVue, toVue } from './utils.ts'

export type { VideoEditor } from '../../types/webgl-video-editor.ts'

export * from '../constants.ts'

export default Vue.defineComponent({
  name: 'VideoEditor',
  props: {
    messages: { type: Object as Vue.PropType<Record<string, Record<string, string>>>, required: false },
    store: {
      type: Object as Vue.PropType<pub.VideoEditorStore>,
      required: false,
    },
    languages: { type: Array as Vue.PropType<string[]>, required: false },
  },
  emits: ['error'],
  setup(props, ctx) {
    const editor = new VideoEditor_({
      store: props.store,
    })
    const container = Vue.ref<HTMLElement>()

    const vueEditor: pub.VideoEditor = editorToVue(editor)

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

export class VideoEditorLocalStore extends VideoEditorLocalStore_ {
  readonly #canUndo = toVue(() => super.canUndo)
  readonly #canRedo = toVue(() => super.canRedo)

  get canUndo(): boolean {
    return this.#canUndo.value
  }
  get canRedo(): boolean {
    return this.#canRedo.value
  }

  constructor() {
    super()
    Vue.markRaw(this)
  }
}
