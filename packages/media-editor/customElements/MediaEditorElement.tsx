import { createEffectScope, effect, ref } from 'shared/framework/reactivity'
import { type Context2D, EditorView, type Effect, type ImageEditState, type ImageSourceOption } from 'shared/types'
import { downloadBlob, win } from 'shared/utils'

import { MediaEditorUI } from '../components/MediaEditorUI'
import { renderComponentTo } from '../components/renderTo'
import { getDefaultFilters } from '../defaultFilters'
import { MediaEditor } from '../MediaEditor'

const OBSERVED_ATTRS = ['sources', 'effects', 'view', 'assetsPath'] as const
type ObservedAttr = (typeof OBSERVED_ATTRS)[number]

const HTMLElement = ((win.HTMLElement as unknown) ?? Object) as typeof window.HTMLElement

export class MediaEditorElement extends HTMLElement {
  static observedAttributes = OBSERVED_ATTRS

  #scope = createEffectScope()
  #editor: MediaEditor
  #effects = ref<Effect[]>([])
  #unmount: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  #view = ref(EditorView.Crop)

  get sources(): ImageSourceOption[] {
    return this.#editor.sourceInputs.value
  }
  set sources(value: ImageSourceOption[] | undefined) {
    this.#editor.sourceInputs.value = value ?? []
  }

  get editStates() {
    return this.#editor.sources.value.map((source) => source.getState())
  }
  set editStates(states: ImageEditState[]) {
    this.#editor.editStatesIn.value = states
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
    return !!this.#editor.isLoading
  }

  constructor() {
    super()

    this.#editor = this.#scope.run(
      () =>
        new MediaEditor({
          effects: this.#effects,
          onEdit: (index, state) => this.#dispatchEvent('miruedit', { index, ...state }),
          onRenderPreview: () => undefined,
        }),
    )
    this.#effects.value = getDefaultFilters(import.meta.env.ASSETS_PATH)

    this.#unmount = this.#scope.run(() =>
      renderComponentTo(MediaEditorUI, { editor: this.#editor, view: this.#view }, this),
    )
  }

  attributeChangedCallback(name: ObservedAttr, _oldValue: string | null, newValue: string | null) {
    newValue ??= ''

    if (name === 'sources') {
      if (newValue.trimStart().startsWith('[')) {
        try {
          this.sources = JSON.parse(newValue)
          return
        } catch {
          //
        }
      }

      this.sources = newValue ? [newValue] : []
    } else if (name === 'effects') this.#effects.value = newValue && JSON.parse(newValue)
    else if (name === 'assetsPath') this.#effects.value = getDefaultFilters(newValue || undefined)
    else this[name] = newValue as any
  }

  connectedCallback() {
    clearTimeout(this.#disconnectTimeout)
  }
  disconnectedCallback() {
    this.#disconnectTimeout = setTimeout(this.#unmount, 500)
  }

  #dispatchEvent(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  async ready() {
    if (!this.isLoading) return

    return new Promise<void>((resolve) => {
      this.#scope.run(() => {
        const stop = effect(() => {
          if (!this.#editor.isLoading) {
            resolve()
            stop()
          }
        })
      })
    })
  }

  async toBlob(sourceIndex: number, options?: ImageEncodeOptions) {
    return this.#editor.toBlob(sourceIndex, options ?? {})
  }
  renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    return this.#editor.renderPreviewTo(sourceIndex, context)
  }

  async download(sourceIndex: number, { filename = 'edited.jpeg', type = 'image/jpeg', quality = 0.9 } = {}) {
    const editor = this.#editor

    const blob = await editor.toBlob(sourceIndex, { type, quality })
    downloadBlob(blob, filename)
    return true
  }

  dispose() {
    this.#editor.dispose()
    this.#unmount()
  }
}
