import { createEffectScope, onScopeDispose, toRef } from '@/framework/reactivity'
import { type Effect, type ImageEditState, type ImageSourceOption } from '@/types'
import { canvasToBlob } from '@/utils'

import { getDefaultFilters } from './defaultFilters'
import { ImageEditor as ImageEditor_ } from './ImageEditor'

interface ImageEditorProps {
  effects?: Effect[] | (() => Effect[])
  onRenderPreview?: (sourceIndex: number, previewUrl: string) => unknown
  onEdit?: (index: number, state: ImageEditState) => unknown
}

export const editorMap = new WeakMap<ImageEditor, ImageEditor_>()

export class ImageEditor {
  #editor: ImageEditor_
  #thumbnailUrls: string[] = []

  constructor(props: ImageEditorProps) {
    const noop = () => undefined
    const scope = createEffectScope()

    this.#editor = scope.run(() => {
      onScopeDispose(() => (this.#editor = undefined as never))

      return new ImageEditor_({
        effects: toRef(props.effects ?? getDefaultFilters()),
        onRenderPreview: async (sourceIndex) => {
          const source = this.#editor.sources.value[sourceIndex]

          URL.revokeObjectURL(this.#thumbnailUrls[sourceIndex])

          const url = URL.createObjectURL(await canvasToBlob(source.context.canvas))
          this.#thumbnailUrls[sourceIndex] = url

          props.onRenderPreview?.(sourceIndex, url)
        },
        onEdit: props.onEdit ?? noop,
      })
    })

    editorMap.set(this, this.#editor)
  }

  setSources(sources: ImageSourceOption[]) {
    this.#editor.sourceInputs.value = [...sources]
  }

  setEditState(sourceIndex: number, state: ImageEditState) {
    const source = this.#editor.sources.value[sourceIndex]

    source.setState(state)
    source.drawPreview().catch(() => undefined)
  }

  toBlob(sourceIndex: number, options?: ImageEncodeOptions) {
    return this.#editor.toBlob(sourceIndex, options)
  }
}

export { ImageEditor_ }
export const unwrap = (wrapped: ImageEditor) => editorMap.get(wrapped)!
