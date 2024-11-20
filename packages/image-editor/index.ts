import { ImageEditorElement } from './customElements/ImageEditorElement'
import { ImageEditorFilterMenuElement, ImageEditorPreviewElement } from './customElements/wrapper'
export { EffectOpType } from 'renderer/constants'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('image-editor', ImageEditorElement)
  customElements.define('image-editor-preview', ImageEditorPreviewElement)
  customElements.define('image-editor-filter-menu', ImageEditorFilterMenuElement)
}

export { ImageEditorElement }
export { ImageEditor } from './wrapper'
export { getDefaultFilters } from './defaultFilters'
