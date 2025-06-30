import { createEffectScope, onScopeDispose, toRef } from 'fine-jsx'
import { type EffectDefinition, type Renderer } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import { type ImageEditState, type ImageSourceOption } from 'shared/types'
import { canvasToBlob } from 'shared/utils'

import { MediaEditor as MediaEditor_ } from './media-editor'

interface MediaEditorProps {
  effects?: EffectDefinition[] | (() => EffectDefinition[])
  renderer?: Renderer
  manualUpdate?: boolean
  onRenderPreview?: (sourceIndex: number, previewUrl: string) => unknown
  onEdit?: (index: number, state: ImageEditState) => unknown
}

export const editorMap = new WeakMap<MediaEditor, MediaEditor_>()

export class MediaEditor {
  #editor: MediaEditor_
  #thumbnailUrls: string[] = []

  constructor(props: MediaEditorProps) {
    const scope = createEffectScope()

    this.#editor = scope.run(() => {
      onScopeDispose(() => (this.#editor = undefined as never))

      return new MediaEditor_({
        effects: toRef(props.effects ?? getDefaultFilterDefinitions()),
        renderer: props.renderer,
        manualUpdate: props.manualUpdate,
        onRenderPreview: async (sourceIndex) => {
          const source = this.#editor.sources.value[sourceIndex]

          URL.revokeObjectURL(this.#thumbnailUrls[sourceIndex])

          const url = URL.createObjectURL(await canvasToBlob(source.context.canvas))
          this.#thumbnailUrls[sourceIndex] = url

          props.onRenderPreview?.(sourceIndex, url)
        },
        onEdit: props.onEdit ?? (() => undefined),
      })
    })

    editorMap.set(this, this.#editor)
  }

  setSources(sources: ImageSourceOption[]) {
    this.#editor.setSources([...sources])
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
