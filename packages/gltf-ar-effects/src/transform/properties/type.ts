import type { InteractivityTypeSignature } from '../../types.ts'

import type { Graph } from './graph.ts'
import {
  type IInteractivityGraphProperty,
  InteractivityGraphProperty,
} from './interactivity-graph-property.ts'
import { InteractivityPropertyType } from './property-types.ts'

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
