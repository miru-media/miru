import * as Pixi from 'pixi.js'

import type * as pub from '../../types/core.d.ts'
import type { RootNode } from '../../types/internal'

import type { Schema, Track } from './index.ts'
import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, RootNode, Track> implements pub.Timeline {
  static readonly TIMELINE = 'timeline'
  declare parent: RootNode

  container = new Pixi.Container()
  declare readonly type: 'timeline'

  /* eslint-disable @typescript-eslint/class-methods-use-this -- -- */
  protected _init(): void {
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
