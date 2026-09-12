import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'
import type { NonOverlappingUnion } from '#internal'

import { BaseClip } from './base-clip.ts'

export interface AudioClip extends NonOverlappingUnion<BaseClip<Schema.AudioClip>, pub.AudioClip> {}

export class AudioClip extends BaseClip<Schema.AudioClip> implements pub.AudioClip {
  static FIELDS = super.FIELDS.concat([
    { key: 'volume', flags: 0, defaultValue: 1 },
    { key: 'linkedVideo', flags: NODE_FIELD_FLAGS.Readonly | NODE_FIELD_FLAGS.Node },
  ] satisfies pub.NodeFieldDef<pub.AudioClip>[])

  get linkedVideo(): pub.VideoClip | undefined {
    const linkItem =
      this.link?.nodes.length === 2 ? this.link.nodes.find((n) => n.type === 'clip:video') : undefined
    return linkItem && this.doc.nodes.get(linkItem.id)
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
