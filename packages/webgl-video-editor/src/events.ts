import type { ChildNodePosition, Schema } from '../types/core'

export interface VideoEditorEvents {
  'node:create': NodeCreateEvent
  'node:move': NodeMoveEvent
  'node:update': NodeUpdateEvent
  'node:delete': NodeDeleteEvent
  'root:replace': MovieReplaceEvent
}

export class NodeCreateEvent extends Event {
  readonly nodeId: string
  readonly group?: string

  constructor(nodeId: string, group?: string) {
    super('node:create')
    this.nodeId = nodeId
    this.group = group
  }
}

export class NodeUpdateEvent extends Event {
  readonly nodeId: string
  readonly from: Partial<Schema.AnyNodeSchema>
  readonly group?: string
  readonly parentId?: string
  readonly index?: number

  constructor(nodeId: string, from: Partial<Schema.AnyNodeSchema>, group?: string) {
    super('node:update')
    this.nodeId = nodeId
    this.from = from
    this.group = group
  }
}

export class NodeDeleteEvent extends Event {
  nodeId: string
  readonly group?: string

  constructor(nodeId: string, group?: string) {
    super('node:delete')
    this.nodeId = nodeId
    this.group = group
  }
}

export class NodeMoveEvent extends Event {
  nodeId: string
  from?: ChildNodePosition
  readonly group?: string

  constructor(nodeId: string, from: ChildNodePosition | undefined, group?: string) {
    super('node:move')
    this.nodeId = nodeId
    this.from = from
    this.group = group
  }
}

export class MovieReplaceEvent extends Event {
  constructor() {
    super('root:replace')
  }
}

export class AssetCreateEvent extends Event {
  readonly nodeId: string

  constructor(nodeId: string) {
    super('asset:create')
    this.nodeId = nodeId
  }
}
