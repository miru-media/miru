import type * as pub from '#core'

import { BaseTrack } from './base-track.ts'

export class AudioTrack extends BaseTrack<pub.Schema.AudioTrack, pub.AnyAudioClip> {
  isAudio(): this is pub.AudioTrack {
    return true
  }

  toJSON(): pub.Schema.AudioTrack {
    const baseJson = super.toJSON()
    return baseJson
  }
}
