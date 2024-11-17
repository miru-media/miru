import { ref } from '@/framework/reactivity'

import { FilterView } from '../components/Filter'
import { renderComponentTo } from '../components/renderTo'
import { SourcePreview } from '../components/SourcePreview'
import { ImageEditor, unwrap } from '../wrapper'

export { ImageEditor }

export class ImageEditorPreviewElement extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: ImageEditor) {
    renderComponentTo(SourcePreview, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }
}

export class ImageEditorFilterMenuElement extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: ImageEditor) {
    renderComponentTo(FilterView, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }
}
