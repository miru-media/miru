import { InteractivityPropertyType } from './constants'
import { ValueContainer } from './value-container'

export class Value extends ValueContainer {
  init() {
    this.propertyType = InteractivityPropertyType.VALUE
  }
}
