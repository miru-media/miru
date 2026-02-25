import type { ChildNodePosition, Schema } from '../types/core'
import type * as pub from '../types/events.d.ts'
import type { AnyAsset, AnyNode } from '../types/internal'

import type { BaseAsset, MediaAsset } from './assets.ts'
import type { BaseNode } from './nodes/base-node.ts'
import type { VisualClip } from './nodes/visual-clip.ts'

export class NodeCreateEvent extends Event implements pub.NodeCreateEvent {
  declare readonly type: 'node:create'
  readonly node: AnyNode
  readonly group?: string

  constructor(node: BaseNode, group?: string) {
    super('node:create')
    this.node = node as AnyNode
    this.group = group
  }
}

export class NodeUpdateEvent extends Event implements pub.NodeUpdateEvent {
  declare readonly type: 'node:update'
  readonly node: AnyNode
  readonly from: Partial<Schema.AnyNodeSchema>
  readonly group?: string
  readonly parentId?: string
  readonly index?: number

  constructor(node: BaseNode, from: Partial<Schema.AnyNodeSchema>, group?: string) {
    super('node:update')
    this.node = node as AnyNode
    this.from = from
    this.group = group
  }
}

export class NodeMoveEvent extends Event implements pub.NodeMoveEvent {
  declare readonly type: 'node:move'
  readonly node: AnyNode
  readonly from?: ChildNodePosition
  readonly group?: string

  constructor(node: BaseNode, from: ChildNodePosition | undefined, group?: string) {
    super('node:move')
    this.node = node as AnyNode
    this.from = from
    this.group = group
  }
}

export class NodeDeleteEvent extends Event implements pub.NodeDeleteEvent {
  declare readonly type: 'node:delete'
  readonly node: AnyNode
  readonly group?: string

  constructor(node: BaseNode, group?: string) {
    super('node:delete')
    this.node = node as AnyNode
    this.group = group
  }
}

export class AssetCreateEvent extends Event implements pub.AssetCreateEvent {
  declare readonly type: 'asset:create'
  readonly asset: AnyAsset
  readonly source?: Blob | string

  constructor(asset: BaseAsset, source?: Blob | string) {
    super('asset:create')
    this.asset = asset as AnyAsset
    this.source = source
  }
}

export class AssetRefreshEvent extends Event implements pub.AssetRefreshEvent {
  declare readonly type: 'asset:refresh'
  readonly asset: MediaAsset
  readonly source?: Blob | string

  constructor(asset: MediaAsset) {
    super('asset:refresh')
    this.asset = asset
  }
}

export class AssetDeleteEvent extends Event implements pub.AssetDeleteEvent {
  declare readonly type: 'asset:delete'
  readonly asset: AnyAsset

  constructor(asset: BaseAsset) {
    super('asset:delete')
    this.asset = asset as AnyAsset
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
  readonly node?: VisualClip

  constructor(type: T, node: VisualClip | undefined) {
    super(`canvas:${type}`)
    this.node = node
  }
}
