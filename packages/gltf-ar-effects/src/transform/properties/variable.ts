import { LiteralValueContainer } from './literal-value-container'
import { InteractivityPropertyType } from './property-types'

export class Variable extends LiteralValueContainer {
  init() {
    this.propertyType = InteractivityPropertyType.VARIABLE
  }
}
