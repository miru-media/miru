import { Ref, computed, createEffectScope, effect, getCurrentScope, ref, watch } from '@/framework/reactivity'
import { Context2D, Effect, ImageEditState, ImageSourceOption } from '@/types'
import { ImageSourceState } from './ImageSourceState'
import { EffectInternal } from '@/Effect'
import { get2dContext } from '@/utils'
import { Renderer } from '@/engine/Renderer'

export interface ImageEditorOptions {
  effects: Ref<Effect[]>
  onRenderPreview: (index: number) => unknown
  onEdit: (index: number, state: ImageEditState) => unknown
}

export class ImageEditorEngine {
  #scope = getCurrentScope()!
  renderer = new Renderer()

  sourceInputs = ref<ImageSourceOption[]>([])
  sources = ref<ImageSourceState[]>([])
  editStatesIn = ref<(ImageEditState | undefined)[]>()
  #effectsIn: Ref<Effect[]>
  readonly effects = ref<EffectInternal[]>([])
  #isLoadingSource = computed(() => this.sources.value.some((s) => s.isLoading))
  #isLoadingEffects = computed(() => this.effects.value.some((e) => e.isLoading.value))
  #isLoading = computed(() => this.#isLoadingSource.value || this.#isLoadingEffects.value)
  scratchPad2d = get2dContext(undefined, { willReadFrequently: true })

  get isLoadingSource() {
    return this.#isLoadingSource.value
  }

  get isLoadingEffects() {
    return this.#isLoadingEffects.value
  }

  get isLoading() {
    return this.#isLoading.value
  }

  constructor({ effects, onRenderPreview, onEdit }: ImageEditorOptions) {
    if (!this.#scope) throw new Error(`[miru] must be run in an EffectScope`)

    this.#effectsIn = effects
    watch([this.sourceInputs], ([sourceOptions], _prev, onCleanup) => {
      const watchScope = createEffectScope()

      watchScope.run(() => {
        const prevSources = this.sources.value

        // TODO: reuse unchanged sources
        this.sources.value = sourceOptions.map(
          (sourceOption, sourceIndex) =>
            new ImageSourceState({
              sourceOption,
              thumbnailSize: ref({ width: 300, height: 300 }),
              // reuse old canvas to avoid a moment of emptiness
              context: prevSources[sourceIndex]?.context,
              renderer: this.renderer,
              effects: this.effects,
              onRenderPreview: () => onRenderPreview(sourceIndex),
              onEdit: (state) => onEdit(sourceIndex, state),
            }),
        )
      })

      onCleanup(() => watchScope.stop())
    })

    this.#scope.watch([this.sources, this.editStatesIn], ([sources, states]) => {
      states?.forEach((state, index) => state && sources[index]?.setState(state))
    })

    watch([this.#effectsIn], ([effects]) => {
      this.#scope
        .run(() => this.#loadEffects(effects || []))
        // eslint-disable-next-line no-console
        .catch((error) => console.error(`[miru] couldn't load effects`, error))
    })
  }

  renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    return this.sources.value[sourceIndex]?.drawPreview(context)
  }

  async exportToImageBitmap() {
    return this.renderer.toImageBitmap()
  }

  async exportToBlob(sourceIndex: number, { type = 'image/jpeg', quality = 0.9 }: ImageEncodeOptions = {}) {
    const source = this.sources.value[sourceIndex]
    if (!source) throw new Error(`[miru] No image at index ${sourceIndex}`)

    source.drawFullSize()

    return this.renderer.toBlob({ type, quality })
  }

  async #loadEffects(effects: Effect[]) {
    this.effects.value.forEach((effect) => effect.janitor.dispose())
    this.effects.value.length = 0

    this.effects.value = effects.map((effectInfo) => {
      const effect = new EffectInternal(effectInfo, this.renderer, this.scratchPad2d)

      return effect
    })

    await Promise.all(this.effects.value.map((e) => e.promise))
  }

  watch: typeof watch = (source, callback) => this.#scope.run(() => watch(source, callback))
  watchEffect: typeof effect = (callback) => this.#scope.run(() => effect(callback))

  scopeRun<T>(callback: () => T) {
    return this.#scope.run(callback)
  }

  dispose() {
    this.renderer.dispose()
    this.#effectsIn.value.length = this.sourceInputs.value.length = 0
    this.renderer = undefined as never
  }
}
