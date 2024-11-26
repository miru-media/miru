import { MediaEditorElement } from './customElements/MediaEditorElement'
import { MediaEditorFilterMenuElement, MediaEditorPreviewElement } from './customElements/wrapper'
export { EffectOpType } from 'renderer/constants'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-editor', MediaEditorElement)
  customElements.define('media-editor-preview', MediaEditorPreviewElement)
  customElements.define('media-editor-filter-menu', MediaEditorFilterMenuElement)
}

export { MediaEditorElement }
export { MediaEditor } from './wrapper'
export { getDefaultFilters } from './defaultFilters'
