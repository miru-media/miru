import type * as pub from '#core'

import { BaseTrack } from './base-track.ts'

export class AudioTrack extends BaseTrack<pub.Schema.AudioTrack, pub.AnyAudioClip> {
  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isAudio(): this is pub.AudioTrack {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): pub.Schema.AudioTrack {
    const baseJson = super.toJSON()
    return baseJson
  }
}
