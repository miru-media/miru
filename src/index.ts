import { MiruImageEditor } from '@/customElements/ImageEditorCustomElement'
import {
  createImageEditor,
  MiruImageEditorFilterMenu,
  MiruImageEditorPreview,
} from '@/customElements/wrapper'
import { getDefaultFilters } from '@/effects'
export { EffectOpType } from '@/constants'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('miru-image-editor', MiruImageEditor)
  customElements.define('miru-image-editor-preview', MiruImageEditorPreview)
  customElements.define('miru-image-editor-filter-menu', MiruImageEditorFilterMenu)
}

export { MiruImageEditor, createImageEditor, getDefaultFilters }
