import { createEffectScope, type EffectScope, ref, type Ref } from 'fine-jsx'

import { renderComponentTo } from '../components/renderTo'
import { MediaEditor, type MediaEditor_, unwrap } from '../wrapper'

export interface VueInstance {
  editor: MediaEditor
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
  editor: MediaEditor_
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
    editor: { type: MediaEditor, required: true },
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
          editor: unwrap(this.editor),
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
