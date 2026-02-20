import * as Pixi from 'pixi.js'

import type { RootNode } from '../../types/internal'
import { NodeCreateEvent } from '../events.ts'

import type { Schema, Track } from './index.ts'
import { ParentNode } from './parent-node.ts'

export class Timeline extends ParentNode<Schema.Timeline, RootNode, Track> {
  static readonly TIMELINE = 'timeline'
  declare parent: RootNode

  container = new Pixi.Container()
  readonly type = 'timeline' as const

  constructor({ id }: { id: string }, root: RootNode) {
    super(id, root)
    root._emit(new NodeCreateEvent(this))
  }

  toObject(): Schema.Timeline {
    return {
      id: this.id,
      type: this.type,
    }
  }
}
