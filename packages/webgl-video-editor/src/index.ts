import { VideoEditorElement } from './elements/video-editor-element'

export type * from '../types/core'

export * from './elements'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}
