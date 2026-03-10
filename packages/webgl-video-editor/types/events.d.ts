import type { KeyofUnion } from '#internal'

import type { ChildNodePosition } from './core'
import type * as pub from './core'

export class DocDisposeEvent extends Event {
  declare readonly type: 'doc:dispose'
  readonly doc: pub.Document

  constructor(doc: pub.Document)
  clone(doc: pub.Document)
}

export class SettingsUpdateEvent extends Event {
  readonly type: 'settings:update'
  readonly from: Partial<pub.Schema.DocumentSettings>

  constructor(from: Partial<pub.Schema.AnyNodeSchema>)
  clone(from?: Partial<pub.Schema.DocumentSettings>): this
}

export class NodeCreateEvent extends Event {
  readonly type: 'node:create'
  readonly node: pub.AnyNode

  constructor(node: pub.AnyNode)
  clone(node?: pub.AnyNode): this
}

export class NodeUpdateEvent<
    T extends pub.Schema.AnyNodeSchema = pub.Schema.AnyNodeSchema,
    K extends KeyofUnion<T> = KeyofUnion<T>,
  >
  extends Event
  implements pub.NodeUpdateEvent
{
  declare readonly type: 'node:update'
  readonly node: pub.NodesByType[T['type']]
  readonly key: K
  readonly from: T[K]

  constructor(node: pub.NodesByType[T['type']], key: K, from: T[K])
  clone(node?: pub.NodesByType[T['type']], key?: K, from?: T[K]): this
}

export class NodeDeleteEvent extends Event {
  readonly type: 'node:delete'
  readonly node: pub.AnyNode

  constructor(node: pub.AnyNode)
  clone(node?: pub.AnyNode): this
}

export class NodeMoveEvent extends Event {
  readonly type: 'node:move'
  readonly node: pub.AnyNode
  readonly from?: ChildNodePosition

  constructor(node: pub.AnyNode, from: ChildNodePosition | undefined)
  clone(node?: pub.AnyNode, from?: ChildNodePosition): this
}

export class AssetCreateEvent extends Event {
  readonly type: 'asset:create'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset, source?: Blob | string)
  clone(asset?: pub.AnyAsset, source?: Blob | string): this
}

export class AssetRefreshEvent extends Event {
  readonly type: 'asset:refresh'
  readonly asset: pub.MediaAsset

  constructor(asset: pub.MediaAsset)
  clone(asset?: pub.MediaAsset): this
}

export class AssetDeleteEvent extends Event {
  readonly type: 'asset:delete'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset)
  clone(asset?: pub.AnyAsset): this
}

export class PlaybackPlayEvent extends Event {
  readonly type: 'playback:play'
}

export class PlaybackPauseEvent extends Event {
  readonly type: 'playback:pause'
}

export class PlaybackUpdateEvent extends Event {
  readonly type: 'playback:update'
}

export class PlaybackSeekEvent extends Event {
  readonly type: 'playback:seek'
}

export declare class CanvasEvent<T extends string> extends Event {
  readonly type: `canvas:${T}`
  readonly canvasEventType: T
  readonly node?: pub.VisualClip
  constructor(type: T, node: pub.VisualClip | undefined)
  clone(node?: pub.VisualClip): this
}
