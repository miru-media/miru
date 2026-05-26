import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { Clip } from './clip.ts'

export interface AudioClip extends NonOverlappingUnion<Clip<Schema.AudioClip>, pub.AudioClip> {}

export class AudioClip extends Clip<Schema.AudioClip> implements pub.AudioClip {
  static FIELDS = super.FIELDS.concat([
    { key: 'volume', flags: 0, defaultValue: 1 },
  ] satisfies pub.NodeFieldDef<pub.AudioClip>[])

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
