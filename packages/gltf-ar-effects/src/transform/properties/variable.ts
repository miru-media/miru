import { InteractivityPropertyType } from './property-types'
import { ValueContainer } from './value-container'

export class Variable extends ValueContainer {
  init() {
    this.propertyType = InteractivityPropertyType.VARIABLE
  }
}
