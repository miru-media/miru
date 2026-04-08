import { createEffectScope, onScopeDispose, toRef } from 'fine-jsx'
import type { EffectDefinition, Renderer } from 'webgl-effects'
import { getDefaultFilterDefinitions } from 'webgl-effects'

import type { ImageEditState, ImageSourceOption } from 'shared/types'
import { canvasToBlob } from 'shared/utils'

import { MediaEditor as MediaEditor_ } from './media-editor.ts'

interface MediaEditorProps {
  effects?: EffectDefinition[] | (() => EffectDefinition[])
  renderer?: Renderer
  manualUpdate?: boolean
  onRenderPreview?: (previewUrl: string) => unknown
  onEdit?: (state: ImageEditState) => unknown
}

export const editorMap = new WeakMap<MediaEditor, MediaEditor_>()

export class MediaEditor {
  #editor: MediaEditor_
  #thumbnailUrl = ''

  constructor(props: MediaEditorProps) {
    const scope = createEffectScope()

    this.#editor = scope.run(() => {
      onScopeDispose(() => (this.#editor = undefined as never))

      return new MediaEditor_({
        effects: toRef(props.effects ?? getDefaultFilterDefinitions()),
        renderer: props.renderer,
        manualUpdate: props.manualUpdate,
        onRenderPreview: async () => {
          const source = this.#editor.source.value
          if (!source) return

          URL.revokeObjectURL(this.#thumbnailUrl)

          const url = URL.createObjectURL(await canvasToBlob(source.context.canvas))
          this.#thumbnailUrl = url

          props.onRenderPreview?.(url)
        },
        onEdit: props.onEdit ?? (() => undefined),
      })
    })

    editorMap.set(this, this.#editor)
  }

  setSources(source: ImageSourceOption) {
    this.#editor.setSource(source)
  }

  setEditState(state: ImageEditState) {
    const source = this.#editor.source.value

    source?.setState(state)
    source?.drawPreview().catch(() => undefined)
  }

  async toBlob(options?: ImageEncodeOptions): Promise<Blob> {
    return await this.#editor.toBlob(options)
  }
}

export { MediaEditor_ }
export const unwrap = (wrapped: MediaEditor) => editorMap.get(wrapped)!
