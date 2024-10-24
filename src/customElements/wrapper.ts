import { FilterView } from '@/components/Filter'
import { renderComponentTo } from '@/components/renderTo'
import { SourcePreview } from '@/components/SourcePreview'
import { ImageEditor } from '@/editor/ImageEditor'
import { getDefaultFilters } from '@/effects'
import { createEffectScope, ref } from '@/framework/reactivity'

export const createImageEditor = () => {
  const scope = createEffectScope()

  return scope.run(
    () =>
      new ImageEditor({
        effects: ref(getDefaultFilters()),
        onRenderPreview: () => undefined,
        onEdit: () => undefined,
      }),
  )
}

export class MiruImageEditorPreview extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: ImageEditor) {
    renderComponentTo(SourcePreview, { editor, sourceIndex: this.sourceIndex }, this)
  }
}

export class MiruImageEditorFilterMenu extends HTMLElement {
  sourceIndex = ref(0)

  set editor(editor: ImageEditor) {
    renderComponentTo(FilterView, { editor, sourceIndex: this.sourceIndex }, this)
  }
}
