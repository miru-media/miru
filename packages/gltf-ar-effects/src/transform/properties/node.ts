import * as gltf from '@gltf-transform/core'

import type { Declaration } from './declaration'
import type { Event } from './event'
import { Flow } from './flow'
import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import { InteractivityPropertyType } from './property-types'
import type { Type } from './type'
import type { Value } from './value'
import type { Variable } from './variable'

export interface INode extends IInteractivityGraphProperty {
  declaration: Declaration
  config: gltf.RefMap<Type | Value | Variable | Event | Node>
  flows: gltf.RefMap<Flow>
  inputs: gltf.RefMap<Flow>
  outputs: gltf.RefMap<Value>
  values: gltf.RefMap<Value>
}

export class Node extends InteractivityGraphProperty<INode> {
  init() {
    this.propertyType = InteractivityPropertyType.NODE
  }

  getDefaults() {
    return Object.assign(super.getDefaults(), {
      config: new gltf.RefMap(),
      flows: new gltf.RefMap(),
      inputs: new gltf.RefMap(),
      outputs: new gltf.RefMap(),
      values: new gltf.RefMap(),
    })
  }

  setDeclaration(declaration: Declaration) {
    return this.setRef('declaration', declaration)
  }
  getDeclaration() {
    return this.getRef('declaration')
  }

  setValue(id: string, value: Value | null) {
    return this.setRefMap('values', id, value)
  }
  getValue(id: string) {
    return this.getRefMap('values', id)
  }
  listValueIds() {
    return this.listRefMapKeys('values')
  }

  setFlow(id: string, flow: Flow | null): this {
    return this.setRefMap('flows', id, flow)
  }
  getFlow(id: string) {
    return this.getRefMap('flows', id)
  }
  listFlowIds() {
    return this.listRefMapKeys('flows')
  }

  setInput(id: string, flow: Flow | null) {
    return this.setRefMap('inputs', id, flow)
  }
  getInput(id: string) {
    return this.getRefMap('inputs', id)
  }
  listInputIds() {
    return this.listRefMapKeys('inputs')
  }

  setConfig(id: string, value: Type | Value | Variable | Event | Node | null) {
    return this.setRefMap('config', id, value)
  }
  getConfig(id: string) {
    return this.getRefMap('config', id)
  }
  listConfigIds() {
    return this.listRefMapKeys('config')
  }

  createFlow(id?: string, name?: string): Flow {
    return new Flow(this.getGraph(), name).setNode(this).setSocket(id ?? 'in')
  }
}
