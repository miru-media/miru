import * as Pixi from 'pixi.js'

import { NODE_FIELD_FLAGS } from '#constants'
import type * as pub from '#core'
import type { Size } from 'shared/types'
import { useChangeCounter } from 'shared/utils/composables.ts'

import type { RenderDocument } from './render-document.ts'
import { RenderClip } from './render-nodes.ts'

type TextClipStyleFieldKey =
  'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'align' | 'inlineSize' | 'fill' | 'stroke'

export class RenderTextClip extends RenderClip<pub.TextClip> {
  pixiNode!: Pixi.Text
  styleUpdated = useChangeCounter()

  constructor(renderView: RenderDocument, original: pub.TextClip) {
    super(renderView, original)

    const text = this.pixiNode
    text.text = this.original.content
    text.style = {
      fontFamily: original.fontFamily,
      fontSize: original.fontSize,
      fontWeight: original.fontWeight as any,
      fontStyle: original.fontStyle,
      align: original.align,
      wordWrapWidth: original.inlineSize,
      fill: original.fill,
      stroke: original.stroke,
      wordWrap: true,
    }
  }

  _init(): void {
    this.pixiNode = new Pixi.Text()
  }

  getSize(): Size {
    this.styleUpdated.track()

    return {
      width: this.original.inlineSize,
      height: Pixi.CanvasTextMetrics.measureText(this.original.content, this.pixiNode.style).height,
    }
  }

  onRendererUpdate(): void {
    const { original } = this

    for (const { 0: key, 1: animation } of original.animationMap.entries()) {
      if (animation.flags & NODE_FIELD_FLAGS.TextStyleProp && animation.canInterpolate())
        this.onUpdateStyleField(key as TextClipStyleFieldKey)
    }

    super.onRendererUpdate()
  }

  onUpdateStyleField(key: TextClipStyleFieldKey): void {
    const value: any = this.original[key]
    const { style } = this.pixiNode

    if (key === 'inlineSize') style.wordWrapWidth = value
    else if (key === 'align') style.align = value
    else style[key] = value

    this.styleUpdated.inc()
    this.transformUpdated.inc()
  }

  _update<Key extends keyof pub.TextClip>(key: Key): void {
    if (this._updateSpatialVisualField(key)) return

    switch (key) {
      case 'content':
        this.pixiNode.text = this.original.content
        break
      default: {
        const field = this.original._fieldsByKey()[key as string]
        if (field && field.flags & NODE_FIELD_FLAGS.TextStyleProp)
          this.onUpdateStyleField(key as TextClipStyleFieldKey)

        break
      }
    }
  }
}
