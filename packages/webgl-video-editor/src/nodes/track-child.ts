import type { Schema } from '../../types/core'
import type { RootNode } from '../../types/internal'

import type { BaseClip } from './base-clip.ts'
import { BaseNode } from './base-node.ts'
import type { Track } from './track.ts'

export abstract class TrackChild<T extends Schema.TrackChild> extends BaseNode<T, Track> {
  declare duration: number

  constructor(init: T, root: RootNode) {
    super(init.id, root)
    this._defineReactive('duration' as any, init.duration)
  }

  get prevClip(): BaseClip | undefined {
    for (let other = this.prev as BaseNode | undefined; other; other = other.prev)
      if (other.isClip()) return other
  }
  get nextClip(): BaseClip | undefined {
    for (let other = this.next as BaseNode | undefined; other; other = other.next)
      if (other.isClip()) return other
  }
}
