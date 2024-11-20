import { MediaTrimmerElement } from './MediaTrimmerElement'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-trimmer', MediaTrimmerElement)
}

export { MediaTrimmerElement }
