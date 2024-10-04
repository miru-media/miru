import { Effect, ImageEditState, ImageSourceOption } from '@/types'
import { AdjustmentsView } from '@/components/Adjustments'
import { CropView } from '@/components/Cropper'
import { FilterView } from '@/components/Filter'
import { renderComponentTo } from '@/components/renderTo'
import { SourcePreview } from '@/components/SourcePreview'
import { ImageEditorEngine } from '@/engine/ImageEditorEngine'
import {
  EffectScope,
  MaybeRefOrGetter,
  Ref,
  createEffectScope,
  onScopeDispose,
  ref,
  toRef,
} from '@/framework/reactivity'
import { canvasToBlob } from '@/utils'

interface ImageEditorEngineVueProps {
  effects: MaybeRefOrGetter<Effect[]>
  onRenderPreview?: (sourceIndex: number, previewUrl: string) => unknown
  onEdit: (index: number, state: ImageEditState) => unknown
}

export declare interface ImageEditorEngineVue {
  exportToBlob(sourceIndex: number, options?: ImageEncodeOptions): Promise<Blob>
}

export const engineMap = new WeakMap<ImageEditorEngineVue, ImageEditorEngine>()

class ImageEditorEngineVueImpl implements ImageEditorEngineVue {
  #engine: ImageEditorEngine
  #thumbnailUrls: string[] = []

  constructor(props: ImageEditorEngineVueProps) {
    const noop = () => undefined
    const scope = createEffectScope()

    this.#engine = scope.run(() => {
      onScopeDispose(() => (this.#engine = undefined as never))

      return new ImageEditorEngine({
        effects: toRef(props.effects),
        onRenderPreview: async (sourceIndex) => {
          const source = this.#engine.sources.value[sourceIndex]
          if (!source) return

          URL.revokeObjectURL(this.#thumbnailUrls[sourceIndex])

          const url = URL.createObjectURL(await canvasToBlob(source.context.canvas))
          this.#thumbnailUrls[sourceIndex] = url

          props.onRenderPreview?.(sourceIndex, url)
        },
        onEdit: props.onEdit ?? noop,
      })
    })

    engineMap.set(this, this.#engine)
  }

  setSources(sources: ImageSourceOption[]) {
    this.#engine.sourceInputs.value = [...sources]
  }

  exportToBlob(sourceIndex: number, options?: ImageEncodeOptions) {
    return this.#engine.exportToBlob(sourceIndex, options)
  }
}

export const createEngine = (props: ImageEditorEngineVueProps): ImageEditorEngineVue =>
  new ImageEditorEngineVueImpl(props)

interface VueInstance {
  engine: ImageEditorEngineVueImpl
  scope: EffectScope
  sourceIndex: number
  _sourceIndex: Ref<number>

  $el: HTMLElement
  $props: Record<string, unknown>
  $set: (object: unknown, key: unknown, value: unknown) => void
  $emit: (type: string, ...args: unknown[]) => void
}

interface WrappedComponentProps {
  engine: ImageEditorEngine
  sourceIndex: Ref<number>
  showAllSources?: boolean | undefined
}

const wrap = (Component: (props: WrappedComponentProps) => JSX.Element, name: string) => ({
  name,
  props: {
    engine: { type: ImageEditorEngineVueImpl, required: true },
    sourceIndex: { type: Number, default: 0 },
  },
  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()
    this._sourceIndex = ref(0)
  },
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(
        Component,
        { engine: engineMap.get(this.engine)!, sourceIndex: this._sourceIndex, showAllSources: false },
        this.$el,
      ),
    )
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div', { class: 'miru-image-editor' })
  },
  watch: {
    sourceIndex: {
      handler(this: VueInstance, value: number) {
        this._sourceIndex.value = value
      },
      immediate: true,
    },
  },
  destroyed(this: VueInstance) {
    this.scope.stop()
  },
})

export const MiruImageEditorPreview = wrap(SourcePreview, 'miru-image-editor-preview')
export const MiruImageEditorCropper = wrap(CropView, 'miru-image-editor-cropper')
export const MiruImageEditorFilterMenu = wrap(FilterView, 'miru-image-editor-filter-menu')
export const MiruImageEditorAdjustmentsMenu = wrap(AdjustmentsView, 'miru-image-editor-adjustments-menu')
