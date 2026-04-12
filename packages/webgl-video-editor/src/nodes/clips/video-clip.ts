import type { Schema } from '#core'
import type * as pub from '#core'

import { Clip } from './clip.ts'

export class VideoClip extends Clip<Schema.VideoClip> implements pub.VideoClip {
  declare translate: Schema.Point
  declare rotate: number
  declare scale: Schema.Point
  declare effects: pub.VideoClip['effects']

  protected _init(init: Schema.VideoClip): void {
    super._init(init)

    this._initTransformProps(init)
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
