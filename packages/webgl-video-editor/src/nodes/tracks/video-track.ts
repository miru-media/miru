import type * as pub from '#core'

import { BaseTrack } from './base-track.ts'

export class VideoTrack extends BaseTrack<pub.Schema.VideoTrack, pub.AnyVideoClip> {
  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  isVideo(): this is pub.VideoTrack {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): pub.Schema.VideoTrack {
    const baseJson = super.toJSON()
    return baseJson
  }
}
