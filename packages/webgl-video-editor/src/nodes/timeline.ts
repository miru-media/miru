import { NODE_FIELD_FLAGS } from '#constants'
import type { Schema } from '#core'
import type * as pub from '#core'

import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, never, pub.Track> implements pub.Timeline {
  static FIELDS = super.FIELDS.concat([
    { key: 'trackCount', flags: NODE_FIELD_FLAGS.Readonly },
  ] satisfies pub.NodeFieldDef<pub.Timeline>[])

  declare readonly id: 'timeline'

  constructor(doc: pub.Document) {
    super(doc, { id: 'timeline', type: 'timeline' })
  }

  get trackCount(): number {
    return this._count()
  }

  get firstVideoTrack(): pub.Track | undefined {
    const { head } = this
    if (head) return head.isVideo() ? head : head.nextVideo
  }
  get lastVideoTrack(): pub.Track | undefined {
    const { tail } = this
    if (tail) return tail.isVideo() ? tail : tail.prevVideo
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  _init(): void {
    // noop
  }
  isTimeline(): this is Timeline {
    return true
  }
  isVideo(): this is Timeline {
    return true
  }
  isAudio(): this is Timeline {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toJSON(): Schema.Timeline {
    return super.toJSON()
  }
}
