import type * as pub from '#core'

import { BaseTrack } from './base-track.ts'

export class VideoTrack extends BaseTrack<pub.Schema.VideoTrack, pub.AnyVideoClip> {
  isVideo(): this is pub.VideoTrack {
    return true
  }

  toJSON(): pub.Schema.VideoTrack {
    const baseJson = super.toJSON()
    return baseJson
  }
}
