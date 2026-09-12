import type { Schema } from '#core'
import type * as pub from '#core'

import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, never, pub.AnyTrack> implements pub.Timeline {
  declare readonly id: 'timeline'

  constructor(doc: pub.Document) {
    super(doc, { id: 'timeline', type: 'timeline' })
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
