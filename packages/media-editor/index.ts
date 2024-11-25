import { MediaEditorElement } from './customElements/MediaEditorElement'
import { MediaEditorFilterMenuElement, MediaEditorPreviewElement } from './customElements/wrapper'
export { EffectOpType } from 'renderer/constants'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('image-editor', MediaEditorElement)
  customElements.define('image-editor-preview', MediaEditorPreviewElement)
  customElements.define('image-editor-filter-menu', MediaEditorFilterMenuElement)
}

export { MediaEditorElement }
export { MediaEditor } from './wrapper'
export { getDefaultFilters } from './defaultFilters'
