import type { ChildNodePosition } from './core'

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

  constructor(nodeId: string, group?: string)
}

export class NodeUpdateEvent extends Event {
  readonly nodeId: string
  readonly from: Partial<AnySchemaNode>
  readonly group?: string
  readonly parentId?: string
  readonly index?: number

  constructor(nodeId: string, from: Partial<AnySchemaNode>, group?: string)
}

export class NodeDeleteEvent extends Event {
  nodeId: string
  readonly group?: string

  constructor(nodeId: string, group?: string)
}

export class NodeMoveEvent extends Event {
  nodeId: string
  from?: ChildNodePosition
  readonly group?: string

  constructor(nodeId: string, from: ChildNodePosition | undefined, group?: string)
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
