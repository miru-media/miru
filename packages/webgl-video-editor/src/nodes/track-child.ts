import type { AnyClip, Schema } from '#core'

import { BaseNode } from './base-node.ts'
import type { Track } from './track.ts'

export abstract class TrackChild<T extends Schema.TrackChild> extends BaseNode<T, Track> {
  declare duration: number

  protected _init(init: T): void {
    this._defineReactive('duration', init.duration)
  }

  get prevClip(): AnyClip | undefined {
    for (let other = this.prev; other; other = other.prev) if (other.isClip()) return other
  }
  get nextClip(): AnyClip | undefined {
    for (let other = this.next; other; other = other.next) if (other.isClip()) return other
  }
}
