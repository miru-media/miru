import { VideoEditorElement } from './elements/video-editor-element.ts'

export type * from '../types/core.ts'

export * from './elements/index.ts'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}
