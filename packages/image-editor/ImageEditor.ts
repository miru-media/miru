import {
  computed,
  effect,
  type EffectScope,
  getCurrentScope,
  ref,
  type Ref,
  watch,
} from '@/framework/reactivity'
import { type Context2D, type Effect, type ImageEditState, type ImageSourceOption } from '@/types'
import { EffectInternal } from 'reactive-effects/Effect'
import { Renderer } from 'renderer/Renderer'

import { ImageSourceInternal } from './ImageSourceInternal'

export interface ImageEditorOptions {
  effects: Ref<Effect[]>
  onRenderPreview: (index: number) => unknown
  onEdit: (index: number, state: ImageEditState) => unknown
}

export class ImageEditor {
  #scope: EffectScope
  renderer = new Renderer()

  sourceInputs = ref<ImageSourceOption[]>([])
  sources = ref<ImageSourceInternal[]>([])
  editStatesIn = ref<(ImageEditState | undefined)[]>()
  #effectsIn: Ref<Effect[]>
  readonly effects = ref<EffectInternal[]>([])
  #isLoadingSource = computed(() => this.sources.value.some((s) => s.isLoading))
  #isLoadingEffects = computed(() => this.effects.value.some((e) => e.isLoading.value))
  #isLoading = computed(() => this.#isLoadingSource.value || this.#isLoadingEffects.value)

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
    const scope = getCurrentScope()
    if (scope == undefined) throw new Error(`[miru] must be run in an EffectScope`)
    this.#scope = scope

    this.#effectsIn = effects
    watch([this.sourceInputs], ([sourceOptions], [prevSourceOptions]) => {
      const prevSources = this.sources.value
      const prevSourcesByOption = (prevSourceOptions ?? []).reduce((acc, so, i) => {
        if (!acc.has(so)) acc.set(so, [])
        const list = acc.get(so)!
        list.push(prevSources[i])
        return acc
      }, new Map<ImageSourceOption, ImageSourceInternal[]>())

      const newSources = new Set<ImageSourceInternal>()

      this.#scope.run(() => {
        sourceOptions.forEach((sourceOption, sourceIndex) => {
          newSources.add(
            prevSourcesByOption.get(sourceOption)?.shift() ??
              new ImageSourceInternal({
                sourceOption,
                thumbnailSize: ref({ width: 300, height: 300 }),
                renderer: this.renderer,
                effects: this.effects,
                onRenderPreview: () => onRenderPreview(sourceIndex),
                onEdit: (state) => onEdit(sourceIndex, state),
              }),
          )
        })
      })

      this.sources.value = Array.from(newSources)

      prevSources.forEach((s) => !newSources.has(s) && s.dispose())
      prevSources.length = 0
      prevSourcesByOption.clear()
    })

    watch([this.sources, this.editStatesIn], ([sources, states]) => {
      states?.forEach((state, index) => state != undefined && sources[index]?.setState(state))
    })

    watch([this.#effectsIn], ([effects]) => {
      this.#scope
        .run(() => this.#loadEffects((effects as Effect[] | undefined) ?? []))

        // eslint-disable-next-line no-console
        .catch((error: unknown) => console.error(`[miru] couldn't load effects`, error))
    })
  }

  renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    return this.sources.value[sourceIndex]?.drawPreview(context)
  }

  async exportToImageBitmap() {
    return this.renderer.toImageBitmap()
  }

  async toBlob(sourceIndex: number, { type = 'image/jpeg', quality = 0.9 }: ImageEncodeOptions = {}) {
    if (sourceIndex < 0 || sourceIndex >= this.sources.value.length)
      throw new Error(`[miru] No image at index ${sourceIndex}`)

    const source = this.sources.value[sourceIndex]

    source.drawFullSize()

    return this.renderer.toBlob({ type, quality })
  }

  async #loadEffects(effects: Effect[]) {
    this.effects.value.forEach((effect) => effect.janitor.dispose())
    this.effects.value.length = 0

    this.effects.value = effects.map((effectInfo) => {
      const effect = new EffectInternal(effectInfo, this.renderer)

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
