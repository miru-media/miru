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

interface ImageEditorEngineVueProps {
  effects: MaybeRefOrGetter<Effect[]>
  onRenderPreview?: (sourceIndex: number) => unknown
  onEdit: (index: number, state: ImageEditState) => void
}

export declare interface ImageEditorEngineVue {
  exportToBlob(sourceIndex: number, options?: ImageEncodeOptions): Promise<Blob>
}

export const engineMap = new WeakMap<ImageEditorEngineVue, ImageEditorEngine>()

class ImageEditorEngineVueImpl implements ImageEditorEngineVue {
  #engine: ImageEditorEngine

  constructor(props: ImageEditorEngineVueProps) {
    const noop = () => undefined
    const scope = createEffectScope()

    this.#engine = scope.run(() => {
      onScopeDispose(() => (this.#engine = undefined as never))

      return new ImageEditorEngine({
        effects: toRef(props.effects),
        onRenderPreview: props.onRenderPreview ?? noop,
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

  $el: HTMLElement
  $props: Record<string, unknown>
  $set: (object: unknown, key: unknown, value: unknown) => void
  $emit: (type: string, ...args: unknown[]) => void
}

const base = {
  props: { engine: { type: ImageEditorEngineVueImpl, required: true } },

  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()
  },

  destroyed(this: VueInstance) {
    this.scope.stop()
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div', { class: 'miru-image-editor' })
  },
}

interface PreviewVueInstance extends VueInstance {
  sourceIndex: number
  _sourceIndex: Ref<number>
}

export const MiruImageEditorPreview = {
  ...base,
  name: 'miru-image-editor-preview',
  props: {
    ...base.props,
    sourceIndex: { type: Number, default: 0 },
  },
  beforeCreate(this: PreviewVueInstance) {
    base.beforeCreate.call(this)
    this._sourceIndex = ref(0)
  },
  mounted(this: PreviewVueInstance) {
    this.scope.run(() =>
      renderComponentTo(
        SourcePreview,
        { engine: engineMap.get(this.engine)!, sourceIndex: this._sourceIndex },
        this.$el,
      ),
    )
  },
  watch: {
    sourceIndex: {
      handler(this: PreviewVueInstance, value: number) {
        this._sourceIndex.value = value
      },
      immediate: true,
    },
  },
}

export const MiruImageEditorCropper = {
  ...base,
  name: 'miru-image-editor-cropper',
  mounted(this: VueInstance) {
    this.scope.run(() => renderComponentTo(CropView, { engine: engineMap.get(this.engine)! }, this.$el))
  },
}

export const MiruImageEditorFilterView = {
  ...base,
  name: 'miru-image-editor-filter-menu',
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(
        FilterView,
        { engine: engineMap.get(this.engine)!, sourceIndex: this._sourceIndex },
        this.$el,
      ),
    )
  },
}

export const MiruImageEditorAdjustmentsView = {
  ...base,
  name: 'miru-image-editor-adjustments-menu',
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(AdjustmentsView, { engine: engineMap.get(this.engine)! }, this.$el),
    )
  },
}
