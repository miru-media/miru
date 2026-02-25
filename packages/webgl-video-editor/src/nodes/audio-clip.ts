import type { Schema } from '../../types/core'
import type * as pub from '../../types/core.d.ts'

import { Clip } from './clip.ts'

export class AudioClip extends Clip<Schema.AudioClip> implements pub.AudioClip {
  declare clipType: 'audio'
  declare container: undefined

  declare volume: number
  declare mute: boolean

  protected _init(init: Schema.AudioClip): void {
    super._init(init)

    this._defineReactive('volume', init.volume, { defaultValue: 1 })
    this._defineReactive('mute', init.mute, { defaultValue: false })
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- --
  isAudio(): this is AudioClip {
    return true
  }

  toObject(): Schema.AudioClip {
    const { volume, mute } = this
    const obj: Schema.AudioClip = super.toObject()

    if (volume !== 1) obj.volume = volume
    if (mute) obj.mute = mute

    return obj
  }
}
