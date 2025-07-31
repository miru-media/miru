import * as gltf from '@gltf-transform/core'

import type { MaybeArray } from 'shared/types'

import type { Declaration } from './declaration.ts'
import type { Event } from './event.ts'
import { Flow } from './flow.ts'
import {
  type IInteractivityGraphProperty,
  InteractivityGraphProperty,
} from './interactivity-graph-property.ts'
import type { LiteralValue } from './literal-value.ts'
import { type LiteralOrPropertyValue, NodeConfigValue } from './node-config-value.ts'
import { InteractivityPropertyType } from './property-types.ts'
import type { Type } from './type.ts'
import type { Variable } from './variable.ts'

export interface INode extends IInteractivityGraphProperty {
  declaration: Declaration
  config: gltf.RefMap<NodeConfigValue>
  flows: gltf.RefMap<Flow>
  inputs: gltf.RefMap<Flow>
  outputs: gltf.RefMap<LiteralValue>
  values: gltf.RefMap<LiteralValue | Type | Variable | Event | Node | gltf.Node | Flow>
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

  setValue(id: string, value: Type | Variable | Event | Node | LiteralValue | Flow | gltf.Node | null) {
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

  setConfig(id: string, value: MaybeArray<LiteralOrPropertyValue>) {
    return this.setRefMap('config', id, new NodeConfigValue(this.graph).setValue(value))
  }
  getConfig(id: string) {
    const value = this.getRefMap('config', id)
    return value ? value.getValue() : null
  }
  listConfigIds() {
    return this.listRefMapKeys('config')
  }

  createFlow(id?: string): Flow {
    return new Flow(this.getGraph()).setNode(this).setSocket(id ?? 'in')
  }
}
