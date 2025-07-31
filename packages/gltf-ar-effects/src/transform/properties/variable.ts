import { LiteralValueContainer } from './literal-value-container.ts'
import { InteractivityPropertyType } from './property-types.ts'

export class Variable extends LiteralValueContainer {
  init() {
    this.propertyType = InteractivityPropertyType.VARIABLE
  }
}
