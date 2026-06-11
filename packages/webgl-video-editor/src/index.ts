import { VideoEditorElement } from './elements/video-editor-element.ts'

export type * as Schema from '#schema'

export * from './elements/index.ts'
export * from '#core'
export * from './editor-actions.ts'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}

export { VideoEditor } from './video-editor.ts'
export { FileSystemAssetStore, HttpAssetLoader } from '#assets'
