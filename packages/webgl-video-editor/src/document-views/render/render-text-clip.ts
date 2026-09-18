import { computed, ref } from 'fine-jsx'
import * as Pixi from 'pixi.js'

import type * as pub from '#core'
import type { Size } from 'shared/types'

import { getClipTransformMatrix } from '../../utils.ts'

import type { MiruFilter } from './pixi-miru-filter.ts'
import type { RenderDocument } from './render-document.ts'
import { RenderNodeView } from './render-nodes.ts'

export class RenderTextClip extends RenderNodeView<pub.TextClip> {
  readonly pixiFilters = ref<MiruFilter[]>([])
  readonly matrix = computed(() => getClipTransformMatrix(this, false))
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
  readonly pixiNode = new Pixi.Text({
    text: this.original.content,
    style: this.style.value,
  })

  readonly _reactiveRenderProps = computed(() => ({
    pixiFilters: this.pixiFilters,
    matrix: this.matrix.value,
    style: this.style.value,
  }))

  constructor(renderView: RenderDocument, original: pub.TextClip) {
    super(renderView, original)
    this._initSpatialVisual()
  }

  getSize(): Size {
    void this.style.value

    return {
      width: this.original.inlineSize,
      height: Pixi.CanvasTextMetrics.measureText(this.original.content, this.pixiNode.style).height,
    }
  }

  updateTransform() {
    this.pixiNode.setFromMatrix(this.matrix.value)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isTextView(): this is RenderTextClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */
  _update<Key extends keyof pub.TextClip>(key: Key): void {
    if (this._updateSpatialVisualField(key)) return

    switch (key) {
      case 'content':
        this.pixiNode.text = this.original.content
        break
      case 'fontFamily':
      case 'fontSize':
      case 'fontWeight':
      case 'fontStyle':
      case 'align':
      case 'inlineSize':
      case 'fill':
      case 'stroke': {
        const key_:
          | 'fontFamily'
          | 'fontSize'
          | 'fontWeight'
          | 'fontStyle'
          | 'align'
          | 'inlineSize'
          | 'fill'
          | 'stroke' = key
        const value = this.original[key_] as any
        const { style } = this.pixiNode

        if (key_ === 'inlineSize') style.wordWrapWidth = value
        else if (key_ === 'align') style.align = value
        else style[key_] = value

        this.pixiNode.setFromMatrix(this.matrix.value)
        break
      }
      default:
    }
  }
}
