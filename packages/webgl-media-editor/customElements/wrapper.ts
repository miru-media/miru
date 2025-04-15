import { ref } from 'fine-jsx'
import { type CropState, type Renderer } from 'webgl-effects'

import { type Effect } from 'reactive-effects/Effect'
import { type Size } from 'shared/types'
import { HTMLElementOrStub } from 'shared/utils/window'

import { FilterView } from '../components/Filter'
import { renderComponentTo } from '../components/renderTo'
import { SourcePreview } from '../components/SourcePreview'
import { WebglEffectsMenu, type WebglEffectsMenuExpose } from '../components/WebglEffectsMenu'
import { MediaEditor, unwrap } from '../wrapper'

export { MediaEditor }

export class MediaEditorPreviewElement extends HTMLElementOrStub {
  static observedAttributes = ['source-index']
  #sourceIndex = ref(0)
  get sourceIndex() {
    return this.#sourceIndex.value
  }

  set sourceIndex(value: number) {
    this.#sourceIndex.value = value
  }

  set editor(editor: MediaEditor) {
    renderComponentTo(SourcePreview, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'source-index') this.sourceIndex = parseInt(newValue ?? '0', 10) || 0
  }
}

export class MediaEditorFilterMenuElement extends HTMLElementOrStub {
  static observedAttributes = ['source-index']
  #sourceIndex = ref(0)
  #showPreview = ref(false)
  #showIntensity = ref(true)
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
    else if (name === 'show-preview') this.showPreview = newValue == null ? false : true
    else if (name === 'show-slider') this.showIntensity = newValue == null ? false : true
  }
}

export class WebglEffectsMenuElement extends HTMLElementOrStub {
  #renderer?: Renderer
  #showIntensity = ref(true)
  #sourceTexture = ref<WebGLTexture>()
  #sourceSize = ref<Size>({ width: 1, height: 1 })
  #thumbnailSize = ref<Size>({ width: 1, height: 1 })
  #crop = ref<CropState>()
  #effects = ref(new Map<string, Effect>())
  #effect = ref<string>()
  #intensity = ref(1)
  #loading = ref(false)
  #ref = ref<WebglEffectsMenuExpose>()
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
        renderer: renderer,
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
