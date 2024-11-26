import { ref } from 'shared/framework/reactivity'

import { FilterView } from '../components/Filter'
import { renderComponentTo } from '../components/renderTo'
import { SourcePreview } from '../components/SourcePreview'
import { MediaEditor, unwrap } from '../wrapper'

export { MediaEditor as MediaEditor }

export class MediaEditorPreviewElement extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: MediaEditor) {
    renderComponentTo(SourcePreview, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }
}

export class MediaEditorFilterMenuElement extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: MediaEditor) {
    renderComponentTo(FilterView, { editor: unwrap(editor), sourceIndex: this.sourceIndex }, this)
  }
}
