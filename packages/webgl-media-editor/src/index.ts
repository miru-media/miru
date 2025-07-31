import { MediaEditorElement } from './customElements/media-editor-element.jsx'
import {
  MediaEditorFilterMenuElement,
  MediaEditorPreviewElement,
  WebglEffectsMenuElement,
} from './customElements/wrapper.ts'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-editor', MediaEditorElement)
  customElements.define('media-editor-preview', MediaEditorPreviewElement)
  customElements.define('media-editor-filter-menu', MediaEditorFilterMenuElement)
  customElements.define('webgl-effects-menu', WebglEffectsMenuElement)
}

export { MediaEditorElement }
export { MediaEditor } from './wrapper.ts'
export { WebglEffectsMenuElement }
export { getDefaultFilterDefinitions } from 'webgl-effects'
