import { EffectScope, Ref, createEffectScope, ref } from '@/framework/reactivity'
import { Context2D, EditorView, Effect, ImageEditState, ImageSource, ImageSourceOption } from '@/types'
import { getDefaultFilters } from '../effects'
import { canvasToBlob } from '../utils'
import { renderComponentTo } from '@/components/renderTo'
import { ImageEditorUI } from '@/components/ImageEditorUI'
import { ImageEditorEngineVue, createEngine, engineMap } from './wrappers'

interface VueInstance {
  engine: ImageEditorEngineVue
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
  name: 'miru-image-editor',
  props: PROP_KEYS,
  emits: EVENT_TYPES,
  data(): Partial<VueInstance> {
    return { thumbnailUrls: [] }
  },
  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()

    this._effects = ref([])
    this._view = ref(EditorView.Crop)

    this.engine = this.scope.run(() =>
      createEngine({
        effects: this._effects,
        onEdit: (index, state) => this.$emit('edit', { index, ...state }),
        onRenderPreview: async (sourceIndex: number) => {
          const engine = engineMap.get(this.engine)!
          const source = engine.sources.value[sourceIndex]
          if (!source) return

          URL.revokeObjectURL(this.thumbnailUrls[sourceIndex])

          this.$set(
            this.thumbnailUrls,
            sourceIndex,
            URL.createObjectURL(await canvasToBlob(source.context.canvas)),
          )
          this.$emit('render', this.thumbnailUrls)
        },
      }),
    )
  },
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(ImageEditorUI, { engine: engineMap.get(this.engine)!, view: this._view }, this.$el),
    )
  },
  destroyed(this: VueInstance) {
    this.scope.stop()
    this.engine = undefined as never
    this.thumbnailUrls.forEach(URL.revokeObjectURL.bind(URL))
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div', { class: 'miru-image-editor' })
  },
  methods: {
    exportToBlob(this: VueInstance, sourceIndex: number, options?: { type: string; quality?: number }) {
      return this.engine.exportToBlob(sourceIndex, options ?? {})
    },
    renderPreviewTo(
      this: VueInstance,
      sourceIndex: number,
      context: ImageBitmapRenderingContext | Context2D,
    ) {
      return engineMap.get(this.engine)!.renderPreviewTo(sourceIndex, context)
    },
  },
  watch: {
    sources: {
      handler(this: VueInstance, value: ImageSourceOption[], prev: ImageSourceOption[] | undefined) {
        if (value && prev && (value === prev || value.every((v, i) => prev[i] === v))) return
        engineMap.get(this.engine)!.sourceInputs.value = value
      },
      immediate: true,
      deep: true,
    },
    editStates: {
      handler(this: VueInstance, value: ImageEditState[]) {
        engineMap.get(this.engine)!.editStatesIn.value = value
      },
      immediate: true,
    },
    effects: {
      handler(this: VueInstance, value: Effect[]) {
        this._effects.value = value || getDefaultFilters(this.assetsPath)
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
