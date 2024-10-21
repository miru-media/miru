import { ImageEditorUI } from '@/components/ImageEditorUI'
import { renderComponentTo } from '@/components/renderTo'
import { getDefaultFilters } from '@/effects'
import { createEffectScope, EffectScope, ref, Ref } from '@/framework/reactivity'
import { Context2D, EditorView, Effect, ImageEditState, ImageSource, ImageSourceOption } from '@/types'

import { editorMap, ImageEditorVue } from './wrappers'

interface VueInstance {
  editor: ImageEditorVue
  sources?: ImageSource[]
  view?: EditorView
  _view: Ref<EditorView>
  effects?: Effect[]
  _effects: Ref<Effect[]>
  assetsPath?: string
  editStates: ImageEditState[]
  scope: EffectScope
  thumbnailUrls: string[]

  $el: HTMLElement
  $props: { editStates?: ImageEditState[] }
  $set: (object: unknown, key: unknown, value: unknown) => void
  $emit: (type: string, ...args: unknown[]) => void
}

const PROP_KEYS = ['sources', 'effects', 'view', 'assetsPath', 'editStates'] as const
const EVENT_TYPES = ['edit', 'render'] as const

export default {
  name: 'miru-image-editor-complete',
  props: PROP_KEYS,
  emits: EVENT_TYPES,
  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()

    this._effects = ref([])
    this._view = ref(EditorView.Crop)

    this.editor = this.scope.run(
      () =>
        new ImageEditorVue({
          effects: this._effects,
          onEdit: (index, state) => this.$emit('edit', { index, ...state }),
          onRenderPreview: (sourceIndex: number, previewUrl) => {
            this.thumbnailUrls.splice(sourceIndex, 1, previewUrl)
            this.$emit('render', this.thumbnailUrls)
          },
        }),
    )
  },
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(ImageEditorUI, { editor: editorMap.get(this.editor)!, view: this._view }, this.$el),
    )
  },
  destroyed(this: VueInstance) {
    this.scope.stop()
    this.editor = undefined as never
    this.thumbnailUrls.forEach(URL.revokeObjectURL.bind(URL))
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div')
  },
  methods: {
    exportToBlob(this: VueInstance, sourceIndex: number, options?: { type: string; quality?: number }) {
      return this.editor.exportToBlob(sourceIndex, options ?? {})
    },
    renderPreviewTo(
      this: VueInstance,
      sourceIndex: number,
      context: ImageBitmapRenderingContext | Context2D,
    ) {
      return editorMap.get(this.editor)!.renderPreviewTo(sourceIndex, context)
    },
  },
  watch: {
    sources: {
      handler(this: VueInstance, value?: ImageSourceOption[], prev?: ImageSourceOption[]) {
        if (value && prev && (value === prev || value.every((v, i) => prev[i] === v))) return
        editorMap.get(this.editor)!.sourceInputs.value = value ?? []
      },
      immediate: true,
      deep: true,
    },
    editStates: {
      handler(this: VueInstance, value: ImageEditState[]) {
        editorMap.get(this.editor)!.editStatesIn.value = value
      },
      immediate: true,
    },
    effects: {
      handler(this: VueInstance, value?: Effect[]) {
        this._effects.value = value ?? getDefaultFilters(this.assetsPath)
      },
      immediate: true,
    },
    view: {
      handler(this: VueInstance, value: EditorView) {
        this._view.value = value
      },
      immediate: true,
    },
  },
}
