import { VideoEditorElement } from './elements/VideoEditorElement'

export type * from '../types/core'

export * from './elements'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}
