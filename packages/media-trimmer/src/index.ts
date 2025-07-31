import { MediaTrimmerElement } from './elements/index.ts'

if (typeof customElements !== 'undefined' && 'define' in customElements) {
  customElements.define('media-trimmer', MediaTrimmerElement)
}

export * from './trim.ts'

export type { LoadInfo, TrimState } from './types/ui.ts'

export { MediaTrimmerElement }
