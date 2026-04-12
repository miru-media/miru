import type { Schema } from '#core'
import type * as pub from '#core'

import { Clip } from './clip.ts'

export class AudioClip extends Clip<Schema.AudioClip> implements pub.AudioClip {
  declare volume: number

  protected _init(init: Schema.AudioClip): void {
    super._init(init)

    this._defineReactive('volume', init.volume, { defaultValue: 1 })
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isMediaClip(): this is AudioClip {
    return true
  }
  isAudio(): this is AudioClip {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.AudioClip {
    const { volume } = this
    const obj: Schema.AudioClip = super.toJSON()

    if (volume !== 1) obj.volume = volume

    return obj
  }
}
