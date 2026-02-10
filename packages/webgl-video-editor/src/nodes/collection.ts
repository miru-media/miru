import type { RootNode } from '../../types/internal'
import type { CollectionKind } from '../../types/schema'
import { NodeCreateEvent } from '../events.ts'

import type { Schema, Track } from './index.ts'
import { ParentNode } from './parent-node.ts'

export class Collection<const T extends Schema.CollectionKind> extends ParentNode<Schema.Collection, Track> {
  static readonly TIMELINE = 'timeline' satisfies Schema.CollectionKind

  readonly type = 'collection' as const
  readonly kind: T

  constructor({ id, kind }: { id: string; kind: T }, root: RootNode) {
    super(id, root)
    this.kind = kind
    root._emit(new NodeCreateEvent(this.id))
  }

  isKind<const K extends CollectionKind>(kind: K): this is Collection<K> {
    return this.kind === (kind as unknown)
  }

  toObject(): Schema.Collection<T> {
    return {
      id: this.id,
      type: this.type,
      kind: this.kind,
    }
  }
}
