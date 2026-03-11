import type { KeyofUnion } from '#internal'

import type * as pub from '../types/core.d.ts'

export class DocDisposeEvent extends Event implements pub.DocDisposeEvent {
  declare readonly type: 'doc:dispose'
  readonly doc: pub.Document

  constructor(doc: pub.Document) {
    super('doc:dispose')
    this.doc = doc
  }

  clone(doc = this.doc): this {
    return new (this.constructor as new (...args: unknown[]) => any)(doc)
  }
}

export class SettingsUpdateEvent extends Event implements pub.SettingsUpdateEvent {
  declare readonly type: 'settings:update'
  readonly from: Partial<pub.Schema.DocumentSettings>

  constructor(from: Partial<pub.Schema.DocumentSettings>) {
    super('settings:update')
    this.from = from
  }
  clone(from = this.from): this {
    return new (this.constructor as new (...args: unknown[]) => any)(from)
  }
}

export class NodeCreateEvent extends Event implements pub.NodeCreateEvent {
  declare readonly type: 'node:create'
  readonly node: pub.AnyNode

  constructor(node: pub.AnyNode) {
    super('node:create')
    this.node = node
  }
  clone(node = this.node): this {
    return new (this.constructor as new (...args: unknown[]) => any)(node)
  }
}

export class NodeUpdateEvent<
  T extends pub.Schema.AnyNodeSchema = pub.Schema.AnyNodeSchema,
  K extends KeyofUnion<T> = KeyofUnion<T>,
>
  extends Event
  implements pub.NodeUpdateEvent<T, K>
{
  declare readonly type: 'node:update'
  readonly node: pub.NodesByType[T['type']]
  readonly key: K
  readonly from: T[K]

  constructor(node: pub.NodesByType[T['type']], key: K, from: T[K]) {
    super('node:update')
    this.node = node
    this.key = key
    this.from = from
  }
  clone(node = this.node, key = this.key, from = this.from): this {
    return new (this.constructor as new (...args: unknown[]) => any)(node, key, from)
  }
}

export class NodeMoveEvent extends Event implements pub.NodeMoveEvent {
  declare readonly type: 'node:move'
  readonly node: pub.AnyNode
  readonly from?: pub.ChildNodePosition

  constructor(node: pub.AnyNode, from: pub.ChildNodePosition | undefined) {
    super('node:move')
    this.node = node
    this.from = from
  }
  clone(node = this.node, from = this.from): this {
    return new (this.constructor as new (...args: unknown[]) => any)(node, from)
  }
}

export class NodeDeleteEvent extends Event implements pub.NodeDeleteEvent {
  declare readonly type: 'node:delete'
  readonly node: pub.AnyNode

  constructor(node: pub.AnyNode) {
    super('node:delete')
    this.node = node
  }
  clone(node = this.node): this {
    return new (this.constructor as new (...args: unknown[]) => any)(node)
  }
}

export class AssetCreateEvent extends Event implements pub.AssetCreateEvent {
  declare readonly type: 'asset:create'
  readonly asset: pub.AnyAsset
  readonly source?: Blob | string

  constructor(asset: pub.AnyAsset, source?: Blob | string) {
    super('asset:create')
    this.asset = asset
    this.source = source
  }
  clone(asset = this.asset, source = this.source): this {
    return new (this.constructor as new (...args: unknown[]) => any)(asset, source)
  }
}

export class AssetDeleteEvent extends Event implements pub.AssetDeleteEvent {
  declare readonly type: 'asset:delete'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset) {
    super('asset:delete')
    this.asset = asset
  }
  clone(asset = this.asset): this {
    return new (this.constructor as new (...args: unknown[]) => any)(asset)
  }
}

export class PlaybackPlayEvent extends Event implements pub.PlaybackPlayEvent {
  declare readonly type: 'playback:play'

  constructor() {
    super('playback:play')
  }
}

export class PlaybackPauseEvent extends Event implements pub.PlaybackPauseEvent {
  declare readonly type: 'playback:pause'

  constructor() {
    super('playback:pause')
  }
}

export class PlaybackUpdateEvent extends Event implements pub.PlaybackUpdateEvent {
  declare readonly type: 'playback:update'

  constructor() {
    super('playback:update')
  }
}

export class PlaybackSeekEvent extends Event implements pub.PlaybackSeekEvent {
  declare readonly type: 'playback:seek'

  constructor() {
    super('playback:seek')
  }
}

export class CanvasEvent<T extends string> extends Event implements pub.CanvasEvent<T> {
  declare readonly type: `canvas:${T}`
  readonly canvasEventType: T
  readonly node?: pub.VisualClip

  constructor(type: T, node: pub.VisualClip | undefined) {
    super(`canvas:${type}`)
    this.canvasEventType = type
    this.node = node
  }
  clone(node = this.node): this {
    return new (this.constructor as new (...args: unknown[]) => any)(this.canvasEventType, node)
  }
}
