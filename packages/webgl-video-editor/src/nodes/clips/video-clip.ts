import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { BaseClip } from './base-clip.ts'

export interface VideoClip extends NonOverlappingUnion<BaseClip<Schema.VideoClip>, pub.VideoClip> {}

export class VideoClip extends BaseClip<Schema.VideoClip> implements pub.VideoClip {
  static FIELDS = super.FIELDS.concat([
    ...BaseClip.TRANSFORM_FIELDS,
    { key: 'linkedAudio', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
  ] satisfies pub.NodeFieldDef<pub.VideoClip>[])

  declare effects: pub.VideoClip['effects']

  get linkedAudio(): pub.AudioClip | undefined {
    const linkItem =
      this.link?.nodes.length === 2 ? this.link.nodes.find((n) => n.type === 'clip:audio') : undefined
    return linkItem && this.doc.nodes.get(linkItem.id)
  }

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
