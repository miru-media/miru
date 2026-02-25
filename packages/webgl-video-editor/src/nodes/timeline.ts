import * as Pixi from 'pixi.js'

import type * as pub from '../../types/core.d.ts'

import type { Document, Schema, Track } from './index.ts'
import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, never, Track> implements pub.Timeline {
  declare readonly id: 'timeline'
  declare readonly type: 'timeline'

  container = new Pixi.Container()

  constructor(doc: Document) {
    super({ id: 'timeline', type: 'timeline' }, doc)
  }

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  _init(): void {
    // noop
  }
  isTimeline(): this is Timeline {
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
