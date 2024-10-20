import { MiruImageEditor } from '@/customElements/ImageEditorCustomElement'
export { getDefaultFilters } from '@/effects'
export { EffectOpType } from '@/constants'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('miru-image-editor', MiruImageEditor)
}

export { MiruImageEditor }
