import { ref } from 'fine-jsx'
import type { CropState, Renderer } from 'webgl-effects'

import type { Effect } from 'reactive-effects/effect'
import type { Size } from 'shared/types'
import { HTMLElementOrStub } from 'shared/utils/window'

import { FilterView } from '../components/filter.jsx'
import { renderComponentTo } from '../components/render-to.ts'
import { SourcePreview } from '../components/source-preview.jsx'
import { WebglEffectsMenu, type WebglEffectsMenuExpose } from '../components/webgl-effects-menu.jsx'
import { MediaEditor, unwrap } from '../wrapper.ts'

export { MediaEditor }

export class MediaEditorPreviewElement extends HTMLElementOrStub {
  static observedAttributes = ['source-index']
  readonly #sourceIndex = ref(0)
  #editor?: MediaEditor
  get sourceIndex() {
    return this.#sourceIndex.value
  }

  set sourceIndex(value: number) {
    this.#sourceIndex.value = value
  }

  get editor() {
    return this.#editor
  }
  set editor(editor: MediaEditor | undefined) {
    this.#editor = editor
    if (editor)
      renderComponentTo(SourcePreview, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'source-index') this.sourceIndex = parseInt(newValue ?? '0', 10) || 0
  }
}

export class MediaEditorFilterMenuElement extends HTMLElementOrStub {
  static observedAttributes = ['source-index']
  readonly #sourceIndex = ref(0)
  readonly #showPreview = ref(false)
  readonly #showIntensity = ref(true)
  #editor?: MediaEditor
  #unmount?: () => void

  get sourceIndex() {
    return this.#sourceIndex.value
  }
  set sourceIndex(value: number) {
    this.#sourceIndex.value = value
  }

  get showPreview() {
    return this.#showPreview.value
  }
  set showPreview(value: boolean) {
    this.#showPreview.value = value
  }

  get showIntensity() {
    return this.#showIntensity.value
  }
  set showIntensity(value: boolean) {
    this.#showIntensity.value = value
  }

  get editor() {
    return this.#editor
  }
  set editor(editor: MediaEditor | undefined) {
    if (editor === this.#editor) return

    this.#unmount?.()
    this.#unmount = undefined

    this.#editor = editor
    if (!editor) return

    this.#unmount = renderComponentTo(
      FilterView,
      {
        editor: unwrap(editor),
        sourceIndex: this.#sourceIndex,
        showPreviews: this.#showPreview,
        showIntensity: this.#showIntensity,
        onChange: (id, intensity) =>
          this.dispatchEvent(new CustomEvent('change', { detail: { effect: id, intensity } })),
      },
      this,
    )
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'source-index') this.sourceIndex = parseInt(newValue ?? '0', 10) || 0
    else if (name === 'show-preview') this.showPreview = newValue != null
    else if (name === 'show-slider') this.showIntensity = newValue != null
  }
}

export class WebglEffectsMenuElement extends HTMLElementOrStub {
  #renderer?: Renderer
  readonly #showIntensity = ref(true)
  readonly #sourceTexture = ref<WebGLTexture>()
  readonly #sourceSize = ref<Size>({ width: 1, height: 1 })
  readonly #thumbnailSize = ref<Size>({ width: 1, height: 1 })
  readonly #crop = ref<CropState>()
  readonly #effects = ref(new Map<string, Effect>())
  readonly #effect = ref<string>()
  readonly #intensity = ref(1)
  readonly #loading = ref(false)
  readonly #ref = ref<WebglEffectsMenuExpose>()
  #unmount?: () => void

  get sourceTexture() {
    return this.#sourceTexture.value
  }
  set sourceTexture(value) {
    this.#sourceTexture.value = value
  }

  get sourceSize() {
    return this.#sourceSize.value
  }
  set sourceSize(value) {
    this.#sourceSize.value = value
  }

  get thumbnailSize() {
    return this.#thumbnailSize.value
  }
  set thumbnailSize(value) {
    this.#thumbnailSize.value = value
  }

  get effects() {
    return this.#effects.value
  }
  set effects(value) {
    this.#effects.value = value
  }

  get effect() {
    return this.#effect.value
  }
  set effect(value) {
    this.#effect.value = value
  }

  get intensity() {
    return this.#intensity.value
  }
  set intensity(value) {
    this.#intensity.value = value
  }

  get loading() {
    return this.#loading.value
  }
  set loading(value: boolean) {
    this.#loading.value = value
  }

  get showIntensity() {
    return this.#showIntensity.value
  }
  set showIntensity(value: boolean) {
    this.#showIntensity.value = value
  }

  get renderer() {
    return this.#renderer
  }
  set renderer(renderer: Renderer | undefined) {
    if (renderer === this.#renderer) return

    this.#unmount?.()
    this.#unmount = undefined

    this.#renderer = renderer
    if (!renderer) return

    this.#unmount = renderComponentTo(
      WebglEffectsMenu,
      {
        ref: this.#ref,
        sourceTexture: this.#sourceTexture,
        sourceSize: this.#sourceSize,
        thumbnailSize: this.#thumbnailSize,
        crop: this.#crop,
        renderer,
        effects: this.#effects,
        effect: this.#effect,
        intensity: this.#intensity,
        showSlider: this.#showIntensity,
        loading: this.#loading,
        onChange: (id, intensity) =>
          this.dispatchEvent(new CustomEvent('change', { detail: { effect: id, intensity } })),
      },
      this,
    )
  }

  scrollToEffect(id: string | undefined, behavior?: ScrollBehavior) {
    this.#ref.value?.scrollToEffect(id, behavior)
  }
}
