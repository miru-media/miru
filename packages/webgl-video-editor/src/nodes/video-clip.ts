import type { Schema } from '#core'
import type * as pub from '#core'

import { Clip } from './clip.ts'

interface Point {
  x: number
  y: number
}
const pointsAreEqual = (a?: Point, b?: Point): boolean =>
  (!a && !b) || (!!a && !!b && a.x === b.x && a.y === b.y)

export class VideoClip extends Clip<Schema.VideoClip> implements pub.VideoClip {
  declare clipType: 'video'

  declare translate: { x: number; y: number }
  declare rotate: number
  declare scale: { x: number; y: number }
  declare effects: pub.VideoClip['effects']

  protected _init(init: Schema.VideoClip): void {
    super._init(init)

    this._defineReactive('translate', init.translate, { equal: pointsAreEqual, defaultValue: { x: 0, y: 0 } })
    this._defineReactive('rotate', init.rotate, { defaultValue: 0 })
    this._defineReactive('scale', init.scale, { equal: pointsAreEqual, defaultValue: { x: 1, y: 1 } })
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isVideo(): this is VideoClip {
    return true
  }

  toJSON(): Schema.VideoClip {
    const { translate, rotate, scale, effects } = this
    const obj: Schema.VideoClip = super.toJSON()

    if (translate.x !== 0 || translate.y !== 0) obj.translate = translate
    if (rotate !== 0) obj.rotate = rotate
    if (scale.x !== 1 || scale.y !== 1) obj.scale = scale
    if (effects.length)
      obj.effects = effects.map(({ id, assetId, intensity }) => ({ id, assetId, intensity }))

    return obj
  }
}
