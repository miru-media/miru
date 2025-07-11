import { createEffectScope, effect, ref } from 'fine-jsx'
import type { Context2D, EffectDefinition } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { EditorView, type ImageEditState, type ImageSourceOption } from 'shared/types'
import { downloadBlob } from 'shared/utils'
import { HTMLElementOrStub } from 'shared/utils/window'

import { MediaEditorUI } from '../components/media-editor-ui'
import { renderComponentTo } from '../components/render-to'
import { DEFAULT_EXPORT_QUALITY } from '../constants'
import { MediaEditor } from '../media-editor'

const OBSERVED_ATTRS = ['sources', 'effects', 'view', 'assetsPath'] as const
const UNMOUNT_TIMEOUT_MS = 500
type ObservedAttr = (typeof OBSERVED_ATTRS)[number]

export class MediaEditorElement extends HTMLElementOrStub {
  static observedAttributes = OBSERVED_ATTRS

  readonly #scope = createEffectScope()
  readonly #editor: MediaEditor
  readonly #effects = ref<EffectDefinition[]>([])
  #unmount?: () => void
  #disconnectTimeout?: ReturnType<typeof setTimeout>
  readonly #view = ref(EditorView.Crop)

  get sources(): ImageSourceOption[] {
    return this.#editor.sourceInputs
  }
  set sources(value: ImageSourceOption[] | undefined) {
    this.#editor.setSources(value ?? [])
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
  set effects(value: EffectDefinition[] | null | undefined) {
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
    return this.#editor.isLoading
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
    this.#effects.value = getDefaultFilterDefinitions(import.meta.env.ASSETS_PATH)
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
    else if (name === 'assetsPath') this.#effects.value = getDefaultFilterDefinitions(newValue || undefined)
    else this[name] = newValue as any
  }

  connectedCallback() {
    clearTimeout(this.#disconnectTimeout)

    this.#unmount ??= this.#scope.run(() =>
      renderComponentTo(MediaEditorUI, { editor: this.#editor, view: this.#view }, this),
    )
  }
  disconnectedCallback() {
    if (this.#unmount) this.#disconnectTimeout = setTimeout(this.#unmount, UNMOUNT_TIMEOUT_MS)
  }

  #dispatchEvent(type: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  async ready() {
    if (!this.isLoading) return

    await new Promise<void>((resolve) => {
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
    return await this.#editor.toBlob(sourceIndex, options ?? {})
  }
  async renderPreviewTo(sourceIndex: number, context: ImageBitmapRenderingContext | Context2D) {
    await this.#editor.renderPreviewTo(sourceIndex, context)
  }

  async download(
    sourceIndex: number,
    { filename = 'edited.jpeg', type = 'image/jpeg', quality = DEFAULT_EXPORT_QUALITY } = {},
  ) {
    const editor = this.#editor

    const blob = await editor.toBlob(sourceIndex, { type, quality })
    downloadBlob(blob, filename)
    return true
  }

  dispose() {
    this.#editor.dispose()
    this.#unmount?.()
  }
}
