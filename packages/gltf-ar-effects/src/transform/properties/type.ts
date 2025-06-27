import { type InteractivityTypeSignature } from '../../types'

import { type Graph } from './graph'
import { type IInteractivityGraphProperty, InteractivityGraphProperty } from './interactivity-graph-property'
import { InteractivityPropertyType } from './property-types'

export interface IType extends IInteractivityGraphProperty {
  _graph: Graph
  signature: InteractivityTypeSignature
}

export class Type extends InteractivityGraphProperty<IType> {
  init() {
    this.propertyType = InteractivityPropertyType.TYPE
  }

  setSignature(signature: InteractivityTypeSignature) {
    return this.set('signature', signature)
  }

  getSignature() {
    return this.get('signature')
  }
}
