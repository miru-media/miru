import { VideoEditorElement } from './elements/video-editor-element.ts'

export type * from './events.ts'
export type * as Schema from '../types/schema.d.ts'

export * from './elements/index.ts'
export type { VideoEditor, VideoEditorStore } from '../types/core.d.ts'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}
