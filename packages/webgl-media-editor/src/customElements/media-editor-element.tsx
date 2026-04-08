import { createEffectScope, effect, ref } from 'fine-jsx'
import type { Context2D, EffectDefinition } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { EditorView, type ImageEditState, type ImageSourceOption } from 'shared/types'
import { downloadBlob } from 'shared/utils'
import { HTMLElementOrStub } from 'shared/utils/window'

import { MediaEditorUI } from '../components/media-editor-ui.jsx'
import { renderComponentTo } from '../components/render-to.ts'
import { DEFAULT_EXPORT_QUALITY } from '../constants.ts'
import { MediaEditor } from '../media-editor.ts'

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

  get source(): ImageSourceOption | undefined {
    return this.#editor.sourceInput
  }
  set source(value: ImageSourceOption | null | undefined) {
    this.#editor.setSource(value ?? undefined)
  }

  get editState(): ImageEditState | undefined {
    return this.#editor.source.value?.getState()
  }
  set editState(state: ImageEditState | null | undefined) {
    this.#editor.setEditState(state ?? { effect: undefined, intensity: 1 })
  }

  get effects(): EffectDefinition[] {
    return this.#effects.value
  }
  set effects(value: EffectDefinition[] | null | undefined) {
    this.#effects.value = value ?? []
  }

  get view(): EditorView {
    return this.#view.value
  }
  set view(value: EditorView | null | undefined) {
    if (value == null) return
    this.#view.value = value
  }

  get isLoading(): boolean {
    return this.#editor.isLoading
  }

  constructor() {
    super()

    this.#editor = this.#scope.run(
      () =>
        new MediaEditor({
          effects: this.#effects,
          onEdit: (state) => this.#dispatchEvent('miruedit', state),
          onRenderPreview: () => undefined,
        }),
    )
    this.#effects.value = getDefaultFilterDefinitions(import.meta.env.ASSETS_PATH)
  }

  attributeChangedCallback(name: ObservedAttr, _oldValue: string | null, newValue: string | null): void {
    const value = newValue ?? ''

    if (name === 'sources') {
      if (value.trimStart().startsWith('[')) {
        try {
          this.source = JSON.parse(value)
          return
        } catch {
          //
        }
      }

      this.source = value
    } else if (name === 'effects') this.#effects.value = value && JSON.parse(value)
    else if (name === 'assetsPath') this.#effects.value = getDefaultFilterDefinitions(value || undefined)
    else this[name] = value as any
  }

  connectedCallback(): void {
    clearTimeout(this.#disconnectTimeout)

    this.#unmount ??= this.#scope.run(() =>
      renderComponentTo(MediaEditorUI, { editor: this.#editor, view: this.#view }, this),
    )
  }
  disconnectedCallback(): void {
    if (this.#unmount) this.#disconnectTimeout = setTimeout(this.#unmount, UNMOUNT_TIMEOUT_MS)
  }

  #dispatchEvent(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  async ready(): Promise<void> {
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

  async toBlob(options?: ImageEncodeOptions): Promise<Blob> {
    return await this.#editor.toBlob(options ?? {})
  }
  async renderPreviewTo(context: ImageBitmapRenderingContext | Context2D): Promise<void> {
    await this.#editor.renderPreviewTo(context)
  }

  async download({
    filename = 'edited.jpeg',
    type = 'image/jpeg',
    quality = DEFAULT_EXPORT_QUALITY,
  } = {}): Promise<void> {
    const editor = this.#editor

    const blob = await editor.toBlob({ type, quality })
    downloadBlob(blob, filename)
  }

  dispose(): void {
    this.#editor.dispose()
    this.#unmount?.()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}
