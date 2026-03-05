import { VideoEditorElement } from './elements/video-editor-element.ts'

export type * as Schema from '#schema'

export * from './elements/index.ts'
export * from '#core'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}

export { VideoEditor } from './video-editor.ts'
export { FileSystemAssetStore, HttpAssetLoader } from '#assets'
