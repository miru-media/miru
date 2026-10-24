import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { BaseClip } from './base-clip.ts'

export interface TextClip extends NonOverlappingUnion<BaseClip<Schema.TextClip>, pub.TextClip> {}

const textStylePropFlags = NODE_FIELD_FLAGS.TextStyleProp | NODE_FIELD_FLAGS.ReactiveProp

export class TextClip extends BaseClip<Schema.TextClip> implements pub.TextClip {
  static FIELDS = super.FIELDS.concat(BaseClip.VISUAL_FIELDS, [
    { key: 'content', flags: NODE_FIELD_FLAGS.ReactiveProp },
    { key: 'fontFamily', flags: textStylePropFlags },
    { key: 'fontSize', flags: textStylePropFlags },
    { key: 'fontWeight', flags: textStylePropFlags, defaultValue: 400 },
    { key: 'fontStyle', flags: textStylePropFlags, defaultValue: 'normal' },
    { key: 'align', flags: textStylePropFlags, defaultValue: 'left' },
    { key: 'inlineSize', flags: textStylePropFlags },
    { key: 'fill', flags: textStylePropFlags | NODE_FIELD_FLAGS.Animatable | NODE_FIELD_FLAGS.Color },
    { key: 'stroke', flags: textStylePropFlags | NODE_FIELD_FLAGS.Animatable | NODE_FIELD_FLAGS.Color },
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
      ...this._visualToJSON(),
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
