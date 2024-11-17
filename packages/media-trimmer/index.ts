import { MediaTrimmerElement } from './MediaTrimmerElement'

export * from './utils'
export * from './trim'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-trimmer', MediaTrimmerElement)
}

export { MediaTrimmerElement }
