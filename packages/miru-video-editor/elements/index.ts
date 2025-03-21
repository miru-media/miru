import { VideoEditorElement } from './VideoEditorElement'

// TODO: move to package root
if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('video-editor', VideoEditorElement)
}

export { VideoEditorElement }
