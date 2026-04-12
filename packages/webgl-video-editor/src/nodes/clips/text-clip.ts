import type { Schema } from '#core'
import type * as pub from '#core'

import { Clip } from './clip.ts'

export class TextClip extends Clip<Schema.TextClip> implements pub.TextClip {
  declare translate: Schema.Point
  declare rotate: number
  declare scale: Schema.Point

  declare content: string
  declare fontFamily: string
  declare fontSize: number
  declare fontWeight: number
  declare fontStyle: Schema.FontStyle
  declare align: Schema.TextAlign
  declare inlineSize: number
  declare fill: string
  declare stroke: string

  protected _init(init: Schema.TextClip): void {
    super._init(init)
    this._initTransformProps(init)

    this._defineReactive('content', init.content)
    this._defineReactive('fontFamily', init.fontFamily)
    this._defineReactive('fontSize', init.fontSize)
    this._defineReactive('fontWeight', init.fontWeight, { defaultValue: 400 })
    this._defineReactive('fontStyle', init.fontStyle, { defaultValue: 'normal' })
    this._defineReactive('align', init.align, { defaultValue: 'left' })
    this._defineReactive('inlineSize', init.inlineSize)
    this._defineReactive('fill', init.fill)
    this._defineReactive('stroke', init.fill)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style -- TODO: check font face is ready
  get isReady(): boolean {
    return true
  }

  isTextClip(): this is TextClip {
    return true
  }
  isVideo(): this is TextClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.TextClip {
    const obj: Schema.TextClip = {
      ...super.toJSON(),
      ...this._transformToJSON(),
      content: this.content,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontWeight: this.fontWeight,
      fontStyle: this.fontStyle,
      inlineSize: this.inlineSize,
      align: this.align,
      fill: this.fill,
      stroke: this.stroke,
    }

    return obj
  }
}
