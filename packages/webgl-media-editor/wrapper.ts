import { createEffectScope, onScopeDispose, toRef } from 'fine-jsx'
import { type EffectDefinition, type Renderer } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { type ImageEditState, type ImageSourceOption } from 'shared/types'
import { canvasToBlob } from 'shared/utils'

import { MediaEditor as MediaEditor_ } from './MediaEditor'

interface MediaEditorProps {
  effects?: EffectDefinition[] | (() => EffectDefinition[])
  renderer?: Renderer
  onRenderPreview?: (sourceIndex: number, previewUrl: string) => unknown
  onEdit?: (index: number, state: ImageEditState) => unknown
}

export const editorMap = new WeakMap<MediaEditor, MediaEditor_>()

export class MediaEditor {
  #editor: MediaEditor_
  #thumbnailUrls: string[] = []

  constructor(props: MediaEditorProps) {
    const noop = () => undefined
    const scope = createEffectScope()

    this.#editor = scope.run(() => {
      onScopeDispose(() => (this.#editor = undefined as never))

      return new MediaEditor_({
        effects: toRef(props.effects ?? getDefaultFilterDefinitions()),
        renderer: props.renderer,
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

export { MediaEditor_ as MediaEditor_ }
export const unwrap = (wrapped: MediaEditor) => editorMap.get(wrapped)!
