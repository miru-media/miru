import { computed, effect, type EffectScope, getCurrentScope, ref, type Ref, watch } from 'fine-jsx'
import { type Context2D, type EffectDefinition, Renderer } from 'webgl-effects'

import { Effect } from 'reactive-effects/effect'
import type { ImageEditState, ImageSourceOption } from 'shared/types'

import { DEFAULT_EXPORT_QUALITY } from './constants'
import { ImageSourceInternal } from './image-source-internal'

export interface MediaEditorOptions {
  effects: Ref<EffectDefinition[]>
  renderer?: Renderer
  manualUpdate?: boolean
  onRenderPreview: (index: number) => unknown
  onEdit: (index: number, state: ImageEditState) => unknown
}

export class MediaEditor {
  readonly #scope: EffectScope
  renderer: Renderer
  readonly #adjustColorEffect: Effect
  manualUpdate: boolean

  sourceInputs: ImageSourceOption[] = []
  sources = ref<ImageSourceInternal[]>([])
  editStatesIn = ref<(ImageEditState | undefined)[]>()
  readonly #effectsIn: Ref<EffectDefinition[]>
  readonly effects = ref(new Map<string, Effect>())
  readonly #isLoadingSource = computed(() => this.sources.value.some((s) => s.isLoading))
  readonly #isLoadingEffects = computed(() =>
    Array.from(this.effects.value.values()).some((e) => e.isLoading),
  )
  readonly #isLoading = computed(() => this.#isLoadingSource.value || this.#isLoadingEffects.value)
  readonly #onRenderPreview: MediaEditorOptions['onRenderPreview']
  readonly #onEdit: MediaEditorOptions['onEdit']

  get isLoadingSource() {
    return this.#isLoadingSource.value
  }

  get isLoadingEffects() {
    return this.#isLoadingEffects.value
  }

  get isLoading() {
    return this.#isLoading.value
  }

  constructor(options: MediaEditorOptions) {
    const scope = getCurrentScope()
    if (scope == null) throw new Error(`[webgl-media-editor] must be run in an EffectScope`)
    this.#scope = scope

    this.renderer = options.renderer ?? new Renderer()
    this.#adjustColorEffect = new Effect(
      { name: '_', ops: [{ type: 'adjust_color', brightness: 0, contrast: 0, saturation: 0 }] },
      this.renderer,
    )
    this.#effectsIn = options.effects
    this.manualUpdate = options.manualUpdate ?? false

    this.#onRenderPreview = options.onRenderPreview
    this.#onEdit = options.onEdit

    watch([this.sources, this.editStatesIn], ([sources, states]) => {
      states?.forEach((state, index) => state != null && sources[index]?.setState(state))
    })

    watch([this.#effectsIn], ([effects]) => {
      this.#scope
        .run(() => this.#loadEffects((effects as EffectDefinition[] | undefined) ?? []))
        // eslint-disable-next-line no-console -- TODO
        .catch((error: unknown) => console.error(`[webgl-media-editor] couldn't load effects`, error))
    })
  }

  setSources(sourceOptions: ImageSourceOption[]) {
    const prevSources = this.sources.value
    const prevSourcesByOption = this.sourceInputs.reduce((acc, so, i) => {
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
              adjustColorOp: this.#adjustColorEffect.ops[0],
              manualUpdate: this.manualUpdate,
              onRenderPreview: () => this.#onRenderPreview(sourceIndex),
              onEdit: (state) => this.#onEdit(sourceIndex, state),
            }),
        )
      })
    })

    this.sources.value = Array.from(newSources)
    this.sourceInputs = sourceOptions

    prevSources.forEach((s) => !newSources.has(s) && s.dispose())
    prevSources.length = 0
    prevSourcesByOption.clear()
  }

  async renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    await this.sources.value[sourceIndex]?.drawPreview(context)
  }

  async toBlob(
    sourceIndex: number,
    { type = 'image/jpeg', quality = DEFAULT_EXPORT_QUALITY }: ImageEncodeOptions = {},
  ) {
    if (sourceIndex < 0 || sourceIndex >= this.sources.value.length)
      throw new Error(`[webgl-media-editor] No image at index ${sourceIndex}`)

    const source = this.sources.value[sourceIndex]

    source.drawFullSize()

    return await this.renderer.toBlob({ type, quality })
  }

  async #loadEffects(definitions: EffectDefinition[]) {
    this.effects.value.forEach((effect) => effect.dispose())
    this.effects.value.clear()

    this.effects.value = new Map(
      definitions.map((def, index) => {
        const { id = index.toString() } = def
        const effect = new Effect({ ...def, id }, this.renderer)

        return [id, effect]
      }),
    )

    await Promise.all(Array.from(this.effects.value.values()).map((e) => e.promise))
  }

  watch: typeof watch = (source, callback) => this.#scope.run(() => watch(source, callback))
  watchEffect: typeof effect = (callback) => this.#scope.run(() => effect(callback))

  scopeRun<T>(callback: () => T) {
    return this.#scope.run(callback)
  }

  dispose() {
    this.renderer.dispose()
    this.#effectsIn.value.length = this.sourceInputs.length = 0
    this.renderer = undefined as never
  }
}
