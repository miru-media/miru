import { createEffectScope, type EffectScope, ref, type Ref } from 'fine-jsx'
import { type Context2D, type EffectDefinition } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { EditorView, type ImageEditState, type ImageSource, type ImageSourceOption } from 'shared/types'

import { MediaEditorUI } from '../components/MediaEditorUI'
import { renderComponentTo } from '../components/renderTo'
import { MediaEditor, unwrap } from '../wrapper'

interface VueInstance {
  editor: MediaEditor
  sources?: ImageSource[]
  view?: EditorView
  _view: Ref<EditorView>
  effects?: EffectDefinition[]
  _effects: Ref<EffectDefinition[]>
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
  name: 'media-editor-complete',
  props: PROP_KEYS,
  emits: EVENT_TYPES,
  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()

    this._effects = ref([])
    this._view = ref(EditorView.Crop)

    this.editor = this.scope.run(
      () =>
        new MediaEditor({
          effects: () => this._effects.value,
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
      renderComponentTo(MediaEditorUI, { editor: unwrap(this.editor), view: this._view }, this.$el),
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
    toBlob(this: VueInstance, sourceIndex: number, options?: { type: string; quality?: number }) {
      return this.editor.toBlob(sourceIndex, options ?? {})
    },
    renderPreviewTo(
      this: VueInstance,
      sourceIndex: number,
      context: ImageBitmapRenderingContext | Context2D,
    ) {
      return unwrap(this.editor).renderPreviewTo(sourceIndex, context)
    },
  },
  watch: {
    sources: {
      handler(this: VueInstance, value?: ImageSourceOption[], prev?: ImageSourceOption[]) {
        if (
          value != undefined &&
          prev != undefined &&
          (value === prev || value.every((v, i) => prev[i] === v))
        )
          return
        unwrap(this.editor).setSources(value ?? [])
      },
      immediate: true,
      deep: true,
    },
    editStates: {
      handler(this: VueInstance, value: ImageEditState[]) {
        unwrap(this.editor).editStatesIn.value = value
      },
      immediate: true,
    },
    effects: {
      handler(this: VueInstance, value?: EffectDefinition[]) {
        this._effects.value = value ?? getDefaultFilterDefinitions(this.assetsPath)
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
