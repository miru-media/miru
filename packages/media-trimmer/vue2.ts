import { createEffectScope, type EffectScope, onScopeDispose, ref, type Ref } from 'fine-jsx'

import { renderComponentTo } from 'miru-video-editor/components/renderTo'

import { type TrimState, VideoTrimmerUI } from './VideoTrimmerUI'

interface VueInstance {
  __scope: EffectScope
  __source: Ref<string | undefined>
  __state: Ref<TrimState | undefined>
  source: string | undefined
  state: TrimState | undefined
  $el: HTMLElement
  $props: Record<string, unknown>
  $set: (object: unknown, key: unknown, value: unknown) => void
  $emit: (type: string, ...args: unknown[]) => void
  $watch: (...args: unknown[]) => () => void
}

export const MediaTrimmer = {
  name: 'media-trimmer',
  props: {
    source: { type: String, required: true },
    modelValue: { type: Object, default: () => ({ start: 0, end: 0, mute: true }) },
  },
  emits: ['change', 'load', 'error'],
  model: {
    prop: 'state',
    event: 'change',
  },
  beforeCreate(this: VueInstance) {
    this.__scope = createEffectScope()
    this.__source = ref<string>()
    this.__state = ref<TrimState>()
  },
  render(h: (...args: unknown[]) => unknown) {
    return h('div')
  },
  mounted(this: VueInstance) {
    this.__scope.run(() => {
      const stopWatches = [
        this.$watch('source', (value: string | undefined) => (this.__source.value = value), {
          immediate: true,
        }),
        this.$watch('state', (value: TrimState | undefined) => (this.__state.value = value), {
          immediate: true,
        }),
      ]

      onScopeDispose(() => stopWatches.forEach((stop) => stop()))

      renderComponentTo(
        VideoTrimmerUI,
        {
          source: this.__source,
          state: this.__state,
          onChange: (value) => this.$emit('change', value),
          onError: (error) => this.$emit('error', error),
          onLoad: (info) => this.$emit('load', info),
        },
        this.$el,
      )
    })
  },
  destroyed(this: VueInstance) {
    this.__scope.stop()
  },
}

export * from './trim'
