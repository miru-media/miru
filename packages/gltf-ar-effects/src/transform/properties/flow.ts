import * as gltf from '@gltf-transform/core'
import type { IProperty } from '@gltf-transform/core'

import type { Node } from './node'
import { InteractivityPropertyType } from './property-types'

export interface IFlow extends IProperty {
  node: Node
  socket: string
}

export class Flow extends gltf.Property<IFlow> {
  declare propertyType: string

  init() {
    this.propertyType = InteractivityPropertyType.FLOW
  }

  setNode(node: Node | null) {
    return this.setRef('node', node)
  }
  getNode() {
    return this.getRef('node')
  }

  setSocket(id: string) {
    return this.set('socket', id)
  }
  getSocket() {
    return this.get('socket')
  }
}
