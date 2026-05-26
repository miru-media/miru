import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { Clip } from './clip.ts'

export interface TextClip extends NonOverlappingUnion<Clip<Schema.TextClip>, pub.TextClip> {}

export class TextClip extends Clip<Schema.TextClip> implements pub.TextClip {
  static FIELDS = super.FIELDS.concat(Clip.TRANSFORM_FIELDS, [
    { key: 'content', flags: 0 },
    { key: 'fontFamily', flags: 0 },
    { key: 'fontSize', flags: 0 },
    { key: 'fontWeight', flags: 0, defaultValue: 400 },
    { key: 'fontStyle', flags: 0, defaultValue: 'normal' },
    { key: 'align', flags: 0, defaultValue: 'left' },
    { key: 'inlineSize', flags: 0 },
    { key: 'fill', flags: 0 },
    { key: 'stroke', flags: 0 },
  ] satisfies pub.NodeFieldDef<pub.TextClip>[])

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
