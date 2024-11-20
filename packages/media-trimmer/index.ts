import { MediaTrimmerElement } from './elements'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-trimmer', MediaTrimmerElement)
}

export * from './trim'

export { MediaTrimmerElement }
