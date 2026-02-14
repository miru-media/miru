import type { ChildNodePosition } from './core'
import type * as Schema from './schema'

type AnyNode = Movie
export interface VideoEditorEvents {
  [type: string]: Event
  error: ErrorEvent
  'node:create': NodeCreateEvent
  'node:move': NodeMoveEvent
  'node:update': NodeUpdateEvent
  'node:delete': NodeDeleteEvent
  'asset:create': AssetCreateEvent
  'asset:refresh': AssetRefreshEvent
  'asset:delete': AssetDeleteEvent
  'playback:play': PlaybackPlayEvent
  'playback:pause': PlaybackPauseEvent
  'playback:update': PlaybackUpdateEvent
}

export class NodeCreateEvent extends Event {
  readonly type: 'node:create'
  readonly node: BaseNode
  readonly group?: string

  constructor(node: Schema.Base, group?: string)
}

export class NodeUpdateEvent extends Event {
  readonly type: 'node:update'
  readonly node: BaseNode
  readonly from: Partial<AnySchemaNode>
  readonly group?: string
  readonly parentId?: string
  readonly index?: number

  constructor(node: Schema.Base, from: Partial<AnySchemaNode>, group?: string)
}

export class NodeDeleteEvent extends Event {
  readonly type: 'node:delete'
  readonly node: BaseNode
  readonly group?: string

  constructor(node: Schema.Base, group?: string)
}

export class NodeMoveEvent extends Event {
  readonly type: 'node:move'
  readonly node: BaseNode
  readonly from?: ChildNodePosition
  readonly group?: string

  constructor(node: Schema.Base, from: ChildNodePosition | undefined, group?: string)
}

export class AssetCreateEvent extends Event {
  readonly type: 'asset:create'
  readonly asset: Schema.AnyAsset

  constructor(asset: Schema.AnyAsset, source?: Blob | string)
}

export class AssetRefreshEvent extends Event {
  readonly type: 'asset:refresh'
  readonly asset: Schema.AvMediaAsset

  constructor(asset: Schema.AvMediaAsset)
}

export class AssetDeleteEvent extends Event {
  readonly type: 'asset:delete'
  readonly asset: Schema.AnyAsset

  constructor(asset: Schema.AnyAsset)
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
