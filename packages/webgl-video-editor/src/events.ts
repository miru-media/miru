import type * as pub from '../types/core.d.ts'

export class DocDisposeEvent extends Event implements pub.DocDisposeEvent {
  declare readonly type: 'doc:dispose'
  readonly doc: pub.Document

  constructor(doc: pub.Document) {
    super('doc:dispose')
    this.doc = doc
  }
}

export class SettingsUpdateEvent extends Event implements pub.SettingsUpdateEvent {
  declare readonly type: 'settings:update'
  readonly from: Partial<pub.Schema.DocumentSettings>

  constructor(from: Partial<pub.Schema.DocumentSettings>) {
    super('settings:update')
    this.from = from
  }
}

export class NodeCreateEvent extends Event implements pub.NodeCreateEvent {
  declare readonly type: 'node:create'
  readonly node: pub.AnyNode
  readonly group?: string

  constructor(node: pub.AnyNode, group?: string) {
    super('node:create')
    this.node = node
    this.group = group
  }
}

export class NodeUpdateEvent extends Event implements pub.NodeUpdateEvent {
  declare readonly type: 'node:update'
  readonly node: pub.AnyNode
  readonly from: Partial<pub.Schema.AnyNodeSchema>
  readonly group?: string
  readonly parentId?: string

  constructor(node: pub.AnyNode, from: Partial<pub.Schema.AnyNodeSchema>, group?: string) {
    super('node:update')
    this.node = node
    this.from = from
    this.group = group
  }
}

export class NodeMoveEvent extends Event implements pub.NodeMoveEvent {
  declare readonly type: 'node:move'
  readonly node: pub.AnyNode
  readonly from?: pub.ChildNodePosition
  readonly group?: string

  constructor(node: pub.AnyNode, from: pub.ChildNodePosition | undefined, group?: string) {
    super('node:move')
    this.node = node
    this.from = from
    this.group = group
  }
}

export class NodeDeleteEvent extends Event implements pub.NodeDeleteEvent {
  declare readonly type: 'node:delete'
  readonly node: pub.AnyNode
  readonly group?: string

  constructor(node: pub.AnyNode, group?: string) {
    super('node:delete')
    this.node = node
    this.group = group
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
}

export class AssetRefreshEvent extends Event implements pub.AssetRefreshEvent {
  declare readonly type: 'asset:refresh'
  readonly asset: pub.MediaAsset
  readonly source?: Blob | string

  constructor(asset: pub.MediaAsset) {
    super('asset:refresh')
    this.asset = asset
  }
}

export class AssetDeleteEvent extends Event implements pub.AssetDeleteEvent {
  declare readonly type: 'asset:delete'
  readonly asset: pub.AnyAsset

  constructor(asset: pub.AnyAsset) {
    super('asset:delete')
    this.asset = asset
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
  readonly node?: pub.VisualClip

  constructor(type: T, node: pub.VisualClip | undefined) {
    super(`canvas:${type}`)
    this.node = node
  }
}
