import { computed, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Size } from 'shared/types'

import type { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'
import { RenderClip, spatialOnRenderUpdate } from './render-nodes.ts'

export class RenderTextClip extends RenderClip<pub.TextClip, Pixi.Text> {
  readonly pixiFilters = ref<MiruFilter[]>([])
  readonly style = computed(() => {
    const { original } = this
    return {
      fontFamily: original.fontFamily,
      fontSize: original.fontSize,
      fontWeight: original.fontWeight.toString() as any,
      fontStyle: original.fontStyle,
      align: original.align,
      wordWrapWidth: original.inlineSize,
      fill: original.fill,
      stroke: original.stroke,
      wordWrap: true,
    }
  })

  readonly _reactiveRenderProps = computed(() => ({
    pixiFilters: this.pixiFilters,
    matrix: this.matrix.value,
    style: this.style.value,
  }))

  constructor(renderView: RenderDocument, original: pub.TextClip) {
    const text = new Pixi.Text()
    super(renderView, original, text)

    text.text = this.original.content
    text.style = this.style.value
  }

  getSize(): Size {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track reactive
    this.style.value

    return {
      width: this.original.inlineSize,
      height: Pixi.CanvasTextMetrics.measureText(this.original.content, this.pixiNode.style).height,
    }
  }

  onRendererUpdate(): void {
    let updatedTransform = false
    const { original } = this

    for (const animation of original.animationMap.values()) {
      if (animation.flags & NODE_FIELD_FLAGS.TextStyleProp && animation.canInterpolate()) {
        Object.assign(this.pixiNode.style, this.style.value)
        this.updateTransform()
        updatedTransform = true
      }
    }

    super.onRendererUpdate()
    if (!updatedTransform) spatialOnRenderUpdate(this)
  }

  _update<Key extends keyof pub.TextClip>(key: Key): void {
    if (this._updateSpatialVisualField(key)) return

    switch (key) {
      case 'content':
        this.pixiNode.text = this.original.content
        break
      default: {
        const field = this.original._fieldsByKey()[key as string]
        if (field && field.flags & NODE_FIELD_FLAGS.TextStyleProp) {
          const key_ = key as
            | 'fontFamily'
            | 'fontSize'
            | 'fontWeight'
            | 'fontStyle'
            | 'align'
            | 'inlineSize'
            | 'fill'
            | 'stroke'
          const value = this.original[key_] as any
          const { style } = this.pixiNode

          if (key_ === 'inlineSize') style.wordWrapWidth = value
          else if (key_ === 'align') style.align = value
          else style[key_] = value

          this.pixiNode.setFromMatrix(this.matrix.value)
        }
        break
      }
    }
  }
}
