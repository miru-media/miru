import type { ChildNodePosition } from './core'
import type * as pub from './core'

export class DocDisposeEvent extends Event {
  declare readonly type: 'doc:dispose'
  readonly doc: pub.Document

  constructor(doc: pub.Document) {
    super('doc:dispose')
    this.doc = doc
  }
}

export class SettingsUpdateEvent extends Event {
  readonly type: 'settings:update'
  readonly from: Partial<pub.Schema.DocumentSettings>

  constructor(from: Partial<pub.Schema.AnyNodeSchema>)
}

export class NodeCreateEvent extends Event {
  readonly type: 'node:create'
  readonly node: pub.AnyNode
  readonly group?: string

  constructor(node: pub.AnyNode, group?: string)
}

export class NodeUpdateEvent extends Event {
  readonly type: 'node:update'
  readonly node: pub.AnyNode
  readonly from: Partial<AnySchemaNode>
  readonly group?: string
  readonly parentId?: string

  constructor(node: pub.AnyNode, from: Partial<pub.Schema.AnyNodeSchema>, group?: string)
}

export class NodeDeleteEvent extends Event {
  readonly type: 'node:delete'
  readonly node: pub.AnyNode
  readonly group?: string

  constructor(node: pub.AnyNode, group?: string)
}

export class NodeMoveEvent extends Event {
  readonly type: 'node:move'
  readonly node: pub.AnyNode
  readonly from?: ChildNodePosition
  readonly group?: string

  constructor(node: pub.AnyNode, from: ChildNodePosition | undefined, group?: string)
}

export class AssetCreateEvent extends Event {
  readonly type: 'asset:create'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset, source?: Blob | string)
}

export class AssetRefreshEvent extends Event {
  readonly type: 'asset:refresh'
  readonly asset: pub.AvMediaAsset

  constructor(asset: pub.AvMediaAsset)
}

export class AssetDeleteEvent extends Event {
  readonly type: 'asset:delete'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset)
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
  readonly node?: pub.VisualClip
  constructor(type: T, node: pub.VisualClip | undefined)
}
