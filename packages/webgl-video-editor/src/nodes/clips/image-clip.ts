import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { BaseClip } from './base-clip.ts'

export interface ImageClip extends NonOverlappingUnion<BaseClip<Schema.ImageClip>, pub.ImageClip> {}

export class ImageClip extends BaseClip<Schema.ImageClip> implements pub.ImageClip {
  static FIELDS = super.FIELDS.concat(BaseClip.TRANSFORM_FIELDS satisfies pub.NodeFieldDef<pub.ImageClip>[])

  declare asset: pub.ImageAsset | undefined
  declare effects: pub.ImageClip['effects']

  get linkedAudio(): pub.AudioClip | undefined {
    const linkItem =
      this.link?.nodes.length === 2 ? this.link.nodes.find((n) => n.type === 'clip:audio') : undefined
    return linkItem && this.doc.nodes.get(linkItem.id)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isImageClip(): this is ImageClip {
    return true
  }
  isVideo(): this is ImageClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.ImageClip {
    const { effects } = this
    const obj: Schema.ImageClip = {
      ...super.toJSON(),
      ...this._transformToJSON(),
    }

    if (effects.length)
      obj.effects = effects.map(({ id, assetId, intensity }) => ({ id, assetId, intensity }))

    return obj
  }
}
