import { renderComponentTo } from '@/components/renderTo'
import { ImageEditor } from '@/editor/ImageEditor'
import {
  createEffectScope,
  EffectScope,
  MaybeRefOrGetter,
  onScopeDispose,
  ref,
  Ref,
  toRef,
} from '@/framework/reactivity'
import { Effect, ImageEditState, ImageSourceOption } from '@/types'
import { canvasToBlob } from '@/utils'

interface ImageEditorVueProps {
  effects: MaybeRefOrGetter<Effect[]>
  onRenderPreview?: (sourceIndex: number, previewUrl: string) => unknown
  onEdit?: (index: number, state: ImageEditState) => unknown
}

export const editorMap = new WeakMap<ImageEditorVue, ImageEditor>()

export class ImageEditorVue {
  #editor: ImageEditor
  #thumbnailUrls: string[] = []

  constructor(props: ImageEditorVueProps) {
    const noop = () => undefined
    const scope = createEffectScope()

    this.#editor = scope.run(() => {
      onScopeDispose(() => (this.#editor = undefined as never))

      return new ImageEditor({
        effects: toRef(props.effects),
        onRenderPreview: async (sourceIndex) => {
          const source = this.#editor.sources.value[sourceIndex]

          URL.revokeObjectURL(this.#thumbnailUrls[sourceIndex])

          const url = URL.createObjectURL(await canvasToBlob(source.context.canvas))
          this.#thumbnailUrls[sourceIndex] = url

          props.onRenderPreview?.(sourceIndex, url)
        },
        onEdit: props.onEdit ?? noop,
      })
    })

    editorMap.set(this, this.#editor)
  }

  setSources(sources: ImageSourceOption[]) {
    this.#editor.sourceInputs.value = [...sources]
  }

  setEditState(sourceIndex: number, state: ImageEditState) {
    const source = this.#editor.sources.value[sourceIndex]

    source.setState(state)
    source.drawPreview().catch(() => undefined)
  }

  exportToBlob(sourceIndex: number, options?: ImageEncodeOptions) {
    return this.#editor.exportToBlob(sourceIndex, options)
  }
}

interface VueInstance {
  editor: ImageEditorVue
  scope: EffectScope
  sourceIndex: number
  _sourceIndex: Ref<number>
  _extraProps: Record<string, Ref>

  $el: HTMLElement
  $props: Record<string, unknown>
  $set: (object: unknown, key: unknown, value: unknown) => void
  $emit: (type: string, ...args: unknown[]) => void
}

interface WrappedComponentProps {
  editor: ImageEditor
  sourceIndex: Ref<number>
  showAllSources?: boolean | undefined
}

export const wrap = (
  Component: (props: WrappedComponentProps) => JSX.Element,
  name: string,
  extraProps?: Record<string, { type: unknown; required?: boolean; default?: unknown }>,
) => ({
  name,
  props: {
    editor: { type: ImageEditorVue, required: true },
    sourceIndex: { type: Number, default: 0 },
    ...extraProps,
  },
  beforeCreate(this: VueInstance) {
    this.scope = createEffectScope()
    this._sourceIndex = ref(0)

    if (extraProps != undefined) {
      this._extraProps = Object.fromEntries(
        Object.entries(extraProps).map(([key, info]) => [key, ref(info.default)]),
      )
    }
  },
  mounted(this: VueInstance) {
    this.scope.run(() =>
      renderComponentTo(
        Component,
        {
          editor: editorMap.get(this.editor)!,
          sourceIndex: this._sourceIndex,
          showAllSources: false,
          ...this._extraProps,
        },
        this.$el,
      ),
    )
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div')
  },
  watch: {
    sourceIndex: {
      handler(this: VueInstance, value: number) {
        this._sourceIndex.value = value
      },
      immediate: true,
    },
    ...(extraProps != undefined &&
      Object.fromEntries(
        Object.entries(extraProps).map(([key]) => [
          key,
          function (this: VueInstance, value: unknown) {
            this._extraProps[key].value = value
          },
        ]),
      )),
  },
  destroyed(this: VueInstance) {
    this.scope.stop()
  },
})
