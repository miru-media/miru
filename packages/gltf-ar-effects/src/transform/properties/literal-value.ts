import { LiteralValueContainer } from './literal-value-container'
import { InteractivityPropertyType } from './property-types'

export class LiteralValue extends LiteralValueContainer {
  init() {
    this.propertyType = InteractivityPropertyType.VALUE
  }

  serializeAsJson(): boolean[] | number[] | string[] | null {
    const value = this.getValue()
    return value == null ? null : Array.isArray(value) ? value : ([value] as boolean[] | number[] | string[])
  }
}
