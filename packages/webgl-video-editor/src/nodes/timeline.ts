import type * as pub from '../../types/core.d.ts'

import type { Schema } from './index.ts'
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
  isVisual(): this is Timeline {
    return true
  }
  isAudio(): this is Timeline {
    return true
  }
  /* eslint-enable @typescript-eslint/class-methods-use-this */

  toObject(): Schema.Timeline {
    return {
      id: this.id,
      type: this.type,
    }
  }
}
