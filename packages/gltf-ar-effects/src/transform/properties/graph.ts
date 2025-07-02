import * as gltf from '@gltf-transform/core'
import type { IProperty } from '@gltf-transform/core'

import type { Declaration } from './declaration'
import type { Event } from './event'
import type { Node } from './node'
import { InteractivityPropertyType } from './property-types'
import type { Type } from './type'
import type { Variable } from './variable'

export interface IGraph extends IProperty {
  types: gltf.RefSet<Type>
  variables: gltf.RefSet<Variable>
  events: gltf.RefSet<Event>
  declarations: gltf.RefSet<Declaration>
  nodes: gltf.RefSet<Node>
}

export class Graph extends gltf.Property<IGraph> {
  declare propertyType: string

  init() {
    this.propertyType = InteractivityPropertyType.GRAPH
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), {
      types: new gltf.RefSet(),
      outputValueSockets: new gltf.RefSet(),
      variables: new gltf.RefSet(),
      events: new gltf.RefSet(),
      declarations: new gltf.RefSet(),
      nodes: new gltf.RefSet(),
    })
  }

  addType(type: Type) {
    return this.addRef('types', type)
  }

  listTypes() {
    return this.listRefs('types')
  }

  addVariable(variable: Variable) {
    return this.addRef('variables', variable)
  }

  removeVariable(variable: Variable) {
    return this.removeRef('variables', variable)
  }

  listVariables() {
    return this.listRefs('variables')
  }

  addEvent(event: Event) {
    return this.addRef('events', event)
  }

  removeEvent(event: Event) {
    return this.removeRef('events', event)
  }

  listEvents() {
    return this.listRefs('events')
  }

  addDeclaration(declaration: Declaration) {
    return this.addRef('declarations', declaration)
  }

  removeDeclaration(declaration: Declaration) {
    return this.removeRef('declarations', declaration)
  }

  listDeclarations() {
    return this.listRefs('declarations')
  }

  addNode(node: Node) {
    return this.addRef('nodes', node)
  }

  removeNode(node: Node) {
    return this.removeRef('nodes', node)
  }

  listNodes() {
    return this.listRefs('nodes')
  }
}
