import { InteractivityPropertyType, type TypeSignature } from './constants'
import { type Graph } from './graph'
import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'

export interface IType extends IInteractivityGraphProperty {
  _graph: Graph
  signature: TypeSignature
}

export class Type extends InteractivityGraphProperty<IType> {
  init() {
    this.propertyType = InteractivityPropertyType.TYPE
  }

  setSignature(signature: TypeSignature) {
    return this.set('signature', signature)
  }

  getSignature() {
    return this.get('signature')
  }
}
