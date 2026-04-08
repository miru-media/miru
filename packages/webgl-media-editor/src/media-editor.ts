import { computed, effect, type EffectScope, getCurrentScope, ref, type Ref, watch } from 'fine-jsx'
import { type Context2D, type EffectDefinition, Renderer } from 'webgl-effects'

import { Effect } from 'reactive-effects/effect'
import type { ImageEditState, ImageSourceOption } from 'shared/types'

import { DEFAULT_EXPORT_QUALITY } from './constants.ts'
import { ImageSourceInternal } from './image-source-internal.ts'

export interface MediaEditorOptions {
  effects: Ref<EffectDefinition[]>
  renderer?: Renderer
  manualUpdate?: boolean
  onRenderPreview: () => unknown
  onEdit: (state: ImageEditState) => unknown
}

export class MediaEditor {
  readonly #scope: EffectScope
  renderer: Renderer
  readonly #adjustColorEffect: Effect
  manualUpdate: boolean

  sourceInput?: ImageSourceOption
  readonly source = ref<ImageSourceInternal>()
  readonly #effectsIn: Ref<EffectDefinition[]>
  readonly effects = ref(new Map<string, Effect>())
  readonly #isLoadingSource = computed(() => this.source.value?.isLoading === true)
  readonly #isLoadingEffects = computed(() =>
    Array.from(this.effects.value.values()).some((e) => e.isLoading),
  )
  readonly #isLoading = computed(() => this.#isLoadingSource.value || this.#isLoadingEffects.value)
  readonly #onRenderPreview: MediaEditorOptions['onRenderPreview']
  readonly #onEdit: MediaEditorOptions['onEdit']

  get isLoadingSource(): boolean {
    return this.#isLoadingSource.value
  }

  get isLoadingEffects(): boolean {
    return this.#isLoadingEffects.value
  }

  get isLoading(): boolean {
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

    watch([this.#effectsIn], ([effects]) => {
      this.#scope
        .run(() => this.#loadEffects((effects as EffectDefinition[] | undefined) ?? []))
        // eslint-disable-next-line no-console -- TODO
        .catch((error: unknown) => console.error(`[webgl-media-editor] couldn't load effects`, error))
    })
  }

  setSource(sourceOption: ImageSourceOption | undefined): void {
    this.source.value?.dispose()
    if (sourceOption == null) {
      this.source.value = undefined
      return
    }

    const newSource = this.scopeRun(
      () =>
        new ImageSourceInternal({
          sourceOption,
          thumbnailSize: ref({ width: 300, height: 300 }),
          renderer: this.renderer,
          effects: this.effects,
          adjustColorOp: this.#adjustColorEffect.ops[0],
          manualUpdate: this.manualUpdate,
          onRenderPreview: () => this.#onRenderPreview(),
          onEdit: (state) => this.#onEdit(state),
        }),
    )

    this.source.value = newSource
    this.sourceInput = sourceOption
  }

  setEditState(state: ImageEditState): void {
    this.source.value?.setState(state)
  }

  async renderPreviewTo(context: ImageBitmapRenderingContext | Context2D) {
    await this.source.value?.drawPreview(context)
  }

  async toBlob({ type = 'image/jpeg', quality = DEFAULT_EXPORT_QUALITY }: ImageEncodeOptions = {}) {
    const source = this.source.value
    if (!source) throw new Error(`[webgl-media-editor] Missing source image`)

    source.drawFullSize()

    return await this.renderer.toBlob({ type, quality })
  }

  async #loadEffects(definitions: EffectDefinition[]): Promise<void> {
    this.effects.value.forEach((effect) => effect.dispose())
    this.effects.value.clear()

    this.effects.value = new Map(
      definitions.map((def, index) => {
        const { id = index.toString() } = def
        const effect = new Effect({ ...def, id }, this.renderer)

        return [id, effect]
      }),
    )

    // eslint-disable-next-line @typescript-eslint/await-thenable -- maybe promises
    await Promise.all(Array.from(this.effects.value.values()).map((e) => e.promise))
  }

  watch: typeof watch = (source, callback) => this.#scope.run(() => watch(source, callback))
  watchEffect: typeof effect = (callback) => this.#scope.run(() => effect(callback))

  scopeRun<T>(callback: () => T): T {
    return this.#scope.run(callback)
  }

  dispose(): void {
    this.renderer.dispose()
    this.source.value?.dispose()
    this.source.value = undefined
    this.effects.value.forEach((e) => e.dispose())
    this.effects.value.clear()
    this.#effectsIn.value.length = 0
    this.renderer = undefined as never
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
