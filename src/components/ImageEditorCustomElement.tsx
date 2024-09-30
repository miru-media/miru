import { renderUITo } from './ImageEditorUI'
import { createEffectScope, effect, ref } from '@/framework/reactivity'
import { Context2D, EditorView, Effect, ImageEditState, ImageSourceOption } from '@/types'
import { downloadBlob, win } from '@/utils'
import { getDefaultFilters } from '@/effects'
import { ImageEditorEngine } from '../engine/ImageEditorEngine'

const OBSERVED_ATTRS = ['sources', 'effects', 'view', 'assetsPath'] as const
type ObservedAttr = (typeof OBSERVED_ATTRS)[number]

export class MiruImageEditor extends (win.HTMLElement || Object) {
  static observedAttributes = OBSERVED_ATTRS

  #scope = createEffectScope()
  #engine: ImageEditorEngine
  #effects = ref<Effect[]>([])
  #unmount: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  #view = ref(EditorView.Browse)

  get sources(): ImageSourceOption[] {
    return this.#engine.sourceInputs.value
  }
  set sources(value: ImageSourceOption[] | undefined) {
    this.#engine.sourceInputs.value = value ?? []
  }

  get editStates() {
    return this.#engine.sources.value.map((source) => source.getState())
  }
  set editStates(states: ImageEditState[]) {
    this.#engine.editStatesIn.value = states
  }

  get effects() {
    return this.#effects.value
  }
  set effects(value: Effect[] | null | undefined) {
    this.#effects.value = value ?? []
  }

  get view() {
    return this.#view.value
  }
  set view(value: EditorView | null | undefined) {
    if (value == null) return
    this.#view.value = value
  }

  get isLoading() {
    return !!this.#engine.isLoading
  }

  constructor() {
    super()

    this.classList.add('miru-image-editor')

    this.#engine = this.#scope.run(
      () =>
        new ImageEditorEngine({
          effects: this.#effects,
          onEdit: (index, state) => this.#dispatchEvent('miruedit', { index, ...state }),
          onRenderPreview: () => undefined,
        }),
    )
    this.#effects.value = getDefaultFilters(import.meta.env.ASSETS_PATH)

    this.#unmount = this.#scope.run(() => renderUITo(this, { engine: this.#engine, view: this.#view }))
  }

  connectedCallback() {
    clearTimeout(this.#disconnectTimeout)
  }

  attributeChangedCallback(name: ObservedAttr, _oldValue: string | null, newValue: string | null) {
    if (name === 'sources') {
      if (!!newValue && newValue.trimStart().startsWith('[')) {
        try {
          this.sources = JSON.parse(newValue)
          return
        } catch {
          //
        }
      }

      this.sources = newValue ? [newValue] : []
    } else if (name === 'effects') this.#effects.value = (newValue && JSON.parse(newValue)) || undefined
    else if (name === 'assetsPath') this.#effects.value = getDefaultFilters(newValue ?? undefined)
    else this[name] = newValue as any
  }

  #dispatchEvent(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  async ready() {
    if (!this.isLoading) return

    return new Promise<void>((resolve) => {
      this.#scope.run(() => {
        const stop = effect(() => {
          if (!this.#engine.isLoading) {
            resolve()
            stop()
          }
        })
      })
    })
  }

  async exportToBlob(sourceIndex: number, options?: ImageEncodeOptions) {
    return this.#engine.exportToBlob(sourceIndex, options ?? {})
  }
  renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    return this.#engine.renderPreviewTo(sourceIndex, context)
  }

  async download(sourceIndex: number, { filename = 'edited.jpeg', type = 'image/jpeg', quality = 0.9 } = {}) {
    const engine = this.#engine
    if (!engine) return false

    const blob = await engine.exportToBlob(sourceIndex, { type, quality })
    downloadBlob(blob, filename)
    return true
  }

  dispose() {
    this.#engine?.dispose()
    this.#unmount()
  }
}
