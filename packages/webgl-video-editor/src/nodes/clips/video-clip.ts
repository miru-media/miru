import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { Clip } from './clip.ts'

export interface VideoClip extends NonOverlappingUnion<Clip<Schema.VideoClip>, pub.VideoClip> {}

export class VideoClip extends Clip<Schema.VideoClip> implements pub.VideoClip {
  static FIELDS = super.FIELDS.concat(Clip.TRANSFORM_FIELDS satisfies pub.NodeFieldDef<pub.VideoClip>[])

  declare effects: pub.VideoClip['effects']

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isMediaClip(): this is VideoClip {
    return true
  }
  isVideo(): this is VideoClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.VideoClip {
    const { effects } = this
    const obj: Schema.VideoClip = {
      ...super.toJSON(),
      ...this._transformToJSON(),
    }

    if (effects.length)
      obj.effects = effects.map(({ id, assetId, intensity }) => ({ id, assetId, intensity }))

    return obj
  }
}
