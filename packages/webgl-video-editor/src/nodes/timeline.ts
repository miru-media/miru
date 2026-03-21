import type { Schema } from '#core'
import type * as pub from '#core'

import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, never, pub.Track> implements pub.Timeline {
  declare readonly parent: undefined
  declare readonly id: 'timeline'
  declare readonly type: 'timeline'

  constructor(doc: pub.Document) {
    super(doc, { id: 'timeline', type: 'timeline' })
  }
  get trackCount(): number {
    return this._count()
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
