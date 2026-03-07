import { ref } from 'fine-jsx'
import * as Vue from 'vue'

import { renderComponentTo } from 'shared/video/render-to'

import type * as pub from '../../types/webgl-video-editor.ts'
import { VideoEditorUI } from '../components/video-editor-ui.jsx'
import styles from '../css/index.module.css'
import { fromVue, toVue } from '../document-views/vue/utils.ts'
import { LocalSync as VideoEditorLocalStore_ } from '../sync'
import { VideoEditor as VideoEditor_ } from '../video-editor.ts'

import { editorToVue } from './vue-video-editor.ts'

export type { VideoEditor } from '#core'

export * from '../constants.ts'

export default Vue.defineComponent({
  name: 'VideoEditor',
  props: {
    editor: {
      type: Object as Vue.PropType<pub.VideoEditor>,
      required: false,
    },
    sync: {
      type: Object as Vue.PropType<pub.VideoEditorDocumentSync>,
      required: false,
    },
    assets: {
      type: Object as Vue.PropType<pub.VideoEditorAssetStore>,
      required: false,
    },
    messages: { type: Object as Vue.PropType<Record<string, Record<string, string>>>, required: false },
    languages: { type: Array as Vue.PropType<string[]>, required: false },
  },
  emits: ['error'],
  setup(props, ctx) {
    const editor =
      props.editor ??
      new VideoEditor_({
        sync: props.sync,
        assets: props.assets,
      })
    const container = Vue.ref<HTMLElement>()

    const vueEditor = editorToVue(editor)
    const children = {
      default: ref<unknown>(),
      timelineEmpty: ref<unknown>(),
    }

    Vue.watch(container, (host, _prev, onCleanup) => {
      if (!host) return

      host.classList.add(styles.host)

      const stop = renderComponentTo(
        VideoEditorUI,
        {
          editor,
          children,
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

    Vue.onScopeDispose(() => vueEditor.dispose())

    const { h } = Vue
    const { slots } = ctx

    const createSlotNode = (name: keyof typeof children) =>
      slots[name] &&
      h(
        'div',
        {
          ref: (el_) => {
            const el = el_ as HTMLElement | null
            if (el && el.parentNode === container.value) el.remove()
            children[name].value = el
          },
        },
        h(slots[name]),
      )

    return () =>
      h('div', { ...ctx.attrs, ref: container }, [createSlotNode('default'), createSlotNode('timelineEmpty')])
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
